import { NextRequest, NextResponse } from 'next/server';

const BUBBLE_API_URL = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '33cb561a966f59ad7ea5e29a1906bf36';

// GET - List all clients
export async function GET(request: NextRequest) {
  try {
    // Fetch all clients from Bubble
    const response = await fetch(
      `${BUBBLE_API_URL}/Clients?sort_field=Created%20Date&descending=true&limit=100`,
      {
        headers: {
          'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Bubble API error:', await response.text());
      return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
    }

    const data = await response.json();
    
    const clients = (data.response?.results || []).map((c: any) => ({
      _id: c._id,
      company_name: c.client_name,
      email: c.email,
      invite_token: c.invite_token,
      invite_sent: c.invite_sent === 'yes' || c.invite_sent === true,
      invite_accepted: c.invite_accepted === 'yes' || c.invite_accepted === true,
      created_at: c['Created Date'],
      subscription_status: c.subscription_status,
    }));

    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new client
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { company_name, email } = body;

    if (!company_name) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    // Generate invite token from company name (lowercase, no spaces)
    const invite_token = company_name.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check if client with this invite_token already exists (prevent duplicates)
    const checkResponse = await fetch(
      `${BUBBLE_API_URL}/Clients?constraints=${encodeURIComponent(JSON.stringify([{key: 'invite_token', constraint_type: 'equals', value: invite_token}]))}`,
      {
        headers: {
          'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        },
      }
    );
    
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (checkData.response?.results?.length > 0) {
        // Client already exists, return the existing one
        const existing = checkData.response.results[0];
        return NextResponse.json({
          client: {
            _id: existing._id,
            company_name: existing.client_name,
            email: existing.email,
            invite_token: existing.invite_token,
            invite_sent: existing.invite_sent === 'yes' || existing.invite_sent === true || false,
            invite_accepted: existing.invite_accepted === 'yes' || existing.invite_accepted === true || false,
            created_at: existing['Created Date'],
            subscription_status: existing.subscription_status,
          },
          existed: true
        });
      }
    }

    // Create client in Bubble with correct field names
    const response = await fetch(`${BUBBLE_API_URL}/Clients`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_name: company_name,
        email: email || null,
        invite_token: invite_token,
        invite_sent: 'no',
        invite_accepted: 'no',
        subscription_status: 'pending',
      }),
    });

    if (!response.ok) {
      console.error('Bubble API error:', await response.text());
      return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
    }

    const data = await response.json();
    
    // Fetch the created client to get full details
    const clientResponse = await fetch(
      `${BUBBLE_API_URL}/Clients/${data.id}`,
      {
        headers: {
          'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        },
      }
    );

    const clientData = await clientResponse.json();
    const client = clientData.response;

    return NextResponse.json({
      client: {
        _id: client._id,
        company_name: client.client_name,
        email: client.email,
        invite_token: client.invite_token || invite_token,
        invite_sent: client.invite_sent === 'yes' || client.invite_sent === true || false,
        invite_accepted: client.invite_accepted === 'yes' || client.invite_accepted === true || false,
        created_at: client['Created Date'],
        subscription_status: client.subscription_status,
      }
    });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
