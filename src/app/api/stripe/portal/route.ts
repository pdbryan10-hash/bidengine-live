import { NextRequest, NextResponse } from 'next/server';
import { createBillingPortalSession } from '@/lib/stripe';
import { fetchClientByClerkId } from '@/lib/bubble';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
    }

    // Get client from Bubble
    const client = await fetchClientByClerkId(userId);
    if (!client?.stripe_customer_id) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    const baseUrl = request.headers.get('origin') || 'https://app.bidengine.co';

    // Create portal session
    const session = await createBillingPortalSession(
      client.stripe_customer_id,
      `${baseUrl}/v/${client._id}`
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal session error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
