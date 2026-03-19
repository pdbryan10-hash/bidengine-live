import { NextRequest, NextResponse } from 'next/server';

const BUBBLE_API_URL = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '33cb561a966f59ad7ea5e29a1906bf36';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { clerk_user_id, email } = body;

    if (!clerk_user_id) {
      return NextResponse.json({ error: 'Missing clerk_user_id' }, { status: 400 });
    }

    // Find client by invite token
    const findResponse = await fetch(
      `${BUBBLE_API_URL}/Clients?constraints=${encodeURIComponent(
        JSON.stringify([{ key: 'invite_token', constraint_type: 'equals', value: token }])
      )}`,
      {
        headers: {
          'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        },
      }
    );

    if (!findResponse.ok) {
      return NextResponse.json({ error: 'Invalid invite' }, { status: 400 });
    }

    const findData = await findResponse.json();
    const client = findData.response?.results?.[0];

    if (!client) {
      return NextResponse.json({ error: 'Invalid invite' }, { status: 400 });
    }

    if (client.invite_accepted) {
      return NextResponse.json({ error: 'Invite already accepted' }, { status: 400 });
    }

    // Update client to mark invite as accepted and link to Clerk user
    const updateResponse = await fetch(
      `${BUBBLE_API_URL}/Clients/${client._id}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${BUBBLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invite_accepted: true,
          clerk_user_id: clerk_user_id,
          email: email || client.email,
          subscription_status: 'active',
        }),
      }
    );

    if (!updateResponse.ok) {
      console.error('Failed to update client:', await updateResponse.text());
      return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      client_id: client._id,
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
