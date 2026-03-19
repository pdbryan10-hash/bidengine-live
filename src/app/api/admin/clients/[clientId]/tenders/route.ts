import { NextRequest, NextResponse } from 'next/server';

const BUBBLE_API_URL = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '33cb561a966f59ad7ea5e29a1906bf36';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;

    // Fetch tenders for this client
    const constraints = JSON.stringify([
      { key: 'client', constraint_type: 'equals', value: clientId }
    ]);
    
    const response = await fetch(
      `${BUBBLE_API_URL}/Tenders%20Data%20Type?constraints=${encodeURIComponent(constraints)}&sort_field=Created%20Date&descending=true&limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Bubble API error:', await response.text());
      return NextResponse.json({ tenders: [] });
    }

    const data = await response.json();
    
    const tenders = (data.response?.results || []).map((t: any) => ({
      _id: t._id,
      tender_name: t.tender_name,
      client_name: t.client_name,
      status: t.status,
      'Created Date': t['Created Date'],
      question_count: t.question_count || 0,
    }));

    return NextResponse.json({ tenders });
  } catch (error) {
    console.error('Error fetching client tenders:', error);
    return NextResponse.json({ tenders: [] });
  }
}
