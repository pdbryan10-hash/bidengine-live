import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { updateClientSubscription, createClient, fetchClientByClerkId } from '@/lib/bubble';
import Stripe from 'stripe';

// Disable body parsing - we need raw body for webhook signature
export const runtime = 'nodejs';

async function getRawBody(request: NextRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = request.body?.getReader();
  if (!reader) throw new Error('No body');
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  
  return Buffer.concat(chunks);
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await getRawBody(request);
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    let event: Stripe.Event;
    
    const webhookSecret = 'whsec_Ha1IYssTgOF7ehWqWpLUnUn51zQatE9g';
    
    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(
          rawBody,
          signature,
          webhookSecret
        );
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    } else {
      // No webhook secret configured - parse event directly (less secure, for testing)
      event = JSON.parse(rawBody.toString()) as Stripe.Event;
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const clerkUserId = session.metadata?.clerk_user_id;

        if (subscriptionId && clerkUserId) {
          // Get subscription details
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
          
          const status = subscription.status === 'trialing' ? 'trialing' : 'active';
          const trialEnd = subscription.trial_end 
            ? new Date(subscription.trial_end * 1000).toISOString() 
            : undefined;
          const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

          // Check if client exists
          const existingClient = await fetchClientByClerkId(clerkUserId);
          
          if (existingClient) {
            // Update existing client
            await updateClientSubscription(
              customerId,
              status,
              subscriptionId,
              trialEnd,
              periodEnd
            );
          } else {
            // Create new client
            await createClient(
              clerkUserId,
              customer.email || '',
              customer.name || customer.email || 'Unknown',
              customerId,
              status,
              trialEnd
            );
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        let status: string;
        switch (subscription.status) {
          case 'trialing':
            status = 'trialing';
            break;
          case 'active':
            status = 'active';
            break;
          case 'past_due':
            status = 'past_due';
            break;
          case 'canceled':
          case 'unpaid':
            status = 'expired';
            break;
          default:
            status = subscription.status;
        }

        const trialEnd = subscription.trial_end 
          ? new Date(subscription.trial_end * 1000).toISOString() 
          : undefined;
        const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

        await updateClientSubscription(
          customerId,
          status,
          subscription.id,
          trialEnd,
          periodEnd
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await updateClientSubscription(
          customerId,
          'expired',
          subscription.id
        );
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

          await updateClientSubscription(
            customerId,
            'active',
            subscriptionId,
            undefined,
            periodEnd
          );
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        await updateClientSubscription(
          customerId,
          'past_due'
        );
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
