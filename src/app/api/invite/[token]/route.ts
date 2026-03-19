import { NextRequest, NextResponse } from 'next/server';

const BUBBLE_API_URL = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '33cb561a966f59ad7ea5e29a1906bf36';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json({ valid: false });
    }

    // Find client by invite token
    const response = await fetch(
      `${BUBBLE_API_URL}/Clients?constraints=${encodeURIComponent(
        JSON.stringify([{ key: 'invite_token', constraint_type: 'equals', value: token }])
      )}`,
      {
        headers: {
          'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json({ valid: false });
    }

    const data = await response.json();
    const client = data.response?.results?.[0];

    if (!client) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      company_name: client.client_name || client.Client_name,
      email: client.email || client.Email,
      already_accepted: client.invite_accepted || false,
      client_id: client._id,
    });
  } catch (error) {
    console.error('Error validating invite:', error);
    return NextResponse.json({ valid: false });
  }
}
