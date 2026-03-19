import { NextRequest, NextResponse } from 'next/server';

const BUBBLE_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });

  const bh = { 'Authorization': `Bearer ${process.env.BUBBLE_API_KEY || ''}` };

  try {
    const constraints = encodeURIComponent(JSON.stringify([
      { key: 'client_id', constraint_type: 'equals', value: clientId }
    ]));
    const res = await fetch(
      `${BUBBLE_BASE}/BidGate_Analysis?constraints=${constraints}&limit=50&sort_field=Created Date&descending=true`,
      { headers: bh }
    );

    if (!res.ok) {
      return NextResponse.json({ analyses: [] });
    }

    const data = await res.json();
    const results = (data.response?.results || []).map((r: any) => ({
      id: r._id,
      tender_name: r.tender_name,
      buyer_name: r.buyer_name,
      buyer_org_type: r.buyer_org_type,
      decision: r.decision,
      readiness_score: r.readiness_score,
      win_probability: r.win_probability,
      created_date: r['Created Date'],
      analysis_json: r.analysis_json,
    }));

    return NextResponse.json({ analyses: results });
  } catch (error) {
    return NextResponse.json({ analyses: [] });
  }
}
