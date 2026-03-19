import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_PRICE_ID } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email, name, companyName } = body;
    
    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing user info' }, { status: 400 });
    }

    // Use company name if provided, otherwise fall back to user name
    const displayName = companyName || name || email;

    console.log('Creating checkout for:', email, 'Company:', companyName, 'Price ID:', STRIPE_PRICE_ID);

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email,
      name: displayName,
      metadata: { 
        clerk_user_id: userId,
        company_name: companyName || ''
      }
    });

    console.log('Customer created:', customer.id);

    // Get the base URL
    const baseUrl = request.headers.get('origin') || 'https://app.bidengine.co';

    // Create checkout session with trial
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: STRIPE_PRICE_ID,
        quantity: 1,
      }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { 
          clerk_user_id: userId,
          company_name: companyName || ''
        }
      },
      success_url: `${baseUrl}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout?canceled=true`,
      metadata: { 
        clerk_user_id: userId,
        company_name: companyName || ''
      }
    });

    console.log('Checkout session created:', session.id);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Checkout session error:', error);
    const message = error?.raw?.message || error?.message || 'Failed to create checkout session';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
