import Stripe from 'stripe';

// Initialize Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// Your Stripe Price ID
export const STRIPE_PRICE_ID = 'price_1SqtCpFGJY2wMgLMy6GXoodB';

// Create a Stripe customer
export async function createStripeCustomer(email: string, name: string, clerkUserId: string): Promise<Stripe.Customer> {
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      clerk_user_id: clerkUserId,
    },
  });
  return customer;
}

// Create a checkout session for subscription with trial
export async function createCheckoutSession(
  customerId: string,
  clerkUserId: string,
  successUrl: string,
  cancelUrl: string
): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: STRIPE_PRICE_ID,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 7,
      metadata: {
        clerk_user_id: clerkUserId,
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      clerk_user_id: clerkUserId,
    },
  });
  return session;
}

// Create billing portal session
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session;
}

// Get subscription status from Stripe
export async function getSubscriptionStatus(customerId: string): Promise<{
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'none';
  trialEnd: Date | null;
  currentPeriodEnd: Date | null;
}> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: 'all',
  });

  if (subscriptions.data.length === 0) {
    return { status: 'none', trialEnd: null, currentPeriodEnd: null };
  }

  const sub = subscriptions.data[0];
  return {
    status: sub.status as 'active' | 'trialing' | 'past_due' | 'canceled' | 'none',
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
  };
}
