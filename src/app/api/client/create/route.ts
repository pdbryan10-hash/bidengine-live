import { NextRequest, NextResponse } from 'next/server';

const BUBBLE_API_KEY = '33cb561a966f59ad7ea5e29a1906bf36';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clerkUserId, email, companyName, userName } = body;
    
    if (!clerkUserId || !companyName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if client already exists
    const constraints = JSON.stringify([
      { key: 'Clerk_user_id', constraint_type: 'equals', value: clerkUserId }
    ]);
    const checkResponse = await fetch(
      `${BUBBLE_API_BASE}/Clients?constraints=${encodeURIComponent(constraints)}`,
      { headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` } }
    );
    
    if (checkResponse.ok) {
      const checkData = await checkResponse.json();
      if (checkData.response.results.length > 0) {
        const existing = checkData.response.results[0];
        
        // Always update client_name (company) and user_name on setup
        // Stripe webhook may have created this with personal name as client_name
        const updates: any = {};
        if (companyName) updates.client_name = companyName;
        if (userName && !existing.user_name) updates.user_name = userName;
        
        if (Object.keys(updates).length > 0) {
          await fetch(`${BUBBLE_API_BASE}/Clients/${existing._id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${BUBBLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          });
        }
        
        // Client already exists, return their ID
        return NextResponse.json({ clientId: existing._id });
      }
    }

    // Generate unique client_id
    const uniqueClientId = Date.now();

    // Create new client in Bubble
    const response = await fetch(`${BUBBLE_API_BASE}/Clients`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Clerk_user_id: clerkUserId,
        client_id: uniqueClientId,
        client_name: companyName,
        user_name: userName || '',
        email: email || '',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create client:', errorText);
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json({ clientId: data.id });

  } catch (error: any) {
    console.error('Create client error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}
