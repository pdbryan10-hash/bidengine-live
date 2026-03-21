import { NextResponse } from 'next/server';

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '33cb561a966f59ad7ea5e29a1906bf36';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId');
  const buyerName = searchParams.get('buyerName');

  if (!clientId || !buyerName) {
    return NextResponse.json({ hasPriorBids: false, profile: null, recentInsights: [], lossWarnings: [] });
  }

  const bHeaders = { 'Authorization': `Bearer ${BUBBLE_API_KEY}` };

  try {
    const [profileRes, insightsRes, allOutcomesRes] = await Promise.all([
      fetch(
        `${BUBBLE_API_BASE}/Buyer_Profile?constraints=${encodeURIComponent(JSON.stringify([
          { key: 'client_id', constraint_type: 'equals', value: clientId },
          { key: 'buyer_name', constraint_type: 'text contains', value: buyerName },
        ]))}&limit=1`,
        { headers: bHeaders }
      ),
      fetch(
        `${BUBBLE_API_BASE}/Outcome_Insight?constraints=${encodeURIComponent(JSON.stringify([
          { key: 'client_id', constraint_type: 'equals', value: clientId },
          { key: 'buyer_name', constraint_type: 'text contains', value: buyerName },
          { key: 'insight_type', constraint_type: 'equals', value: 'negative' },
        ]))}&limit=20`,
        { headers: bHeaders }
      ),
      fetch(
        `${BUBBLE_API_BASE}/Bid_Outcome?constraints=${encodeURIComponent(JSON.stringify([
          { key: 'client', constraint_type: 'equals', value: clientId },
          { key: 'buyer_name', constraint_type: 'text contains', value: buyerName },
        ]))}&limit=1`,
        { headers: bHeaders }
      ),
    ]);

    const profile = profileRes.ok ? (await profileRes.json()).response?.results?.[0] || null : null;
    const negativeInsights: Record<string, unknown>[] = insightsRes.ok
      ? (await insightsRes.json()).response?.results || []
      : [];
    const anyOutcomes = allOutcomesRes.ok
      ? ((await allOutcomesRes.json()).response?.count || 0) > 0
      : false;

    if (!profile && !anyOutcomes) {
      return NextResponse.json({ hasPriorBids: false, profile: null, recentInsights: [], lossWarnings: [], sectorProfile: null });
    }

    // Build loss warnings by category
    const catLosses: Record<string, number> = {};
    negativeInsights.forEach((i) => {
      const cat = i.category as string;
      catLosses[cat] = (catLosses[cat] || 0) + 1;
    });
    const lossWarnings = Object.entries(catLosses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(
        ([cat, count]) =>
          `${count} previous bid${count > 1 ? 's' : ''} with ${buyerName} scored weak on ${cat} — ensure strong evidence here`
      );

    // Fetch sector profile
    const orgType = (profile?.buyer_org_type as string | undefined) || searchParams.get('orgType');
    let sectorProfile = null;
    if (orgType) {
      const sectorRes = await fetch(
        `${BUBBLE_API_BASE}/Sector_Profile?constraints=${encodeURIComponent(JSON.stringify([
          { key: 'org_type', constraint_type: 'equals', value: orgType }
        ]))}&limit=1`,
        { headers: bHeaders }
      );
      if (sectorRes.ok) {
        sectorProfile = (await sectorRes.json()).response?.results?.[0] || null;
      }
    }

    return NextResponse.json({
      hasPriorBids: true,
      profile,
      recentInsights: negativeInsights.slice(0, 5),
      lossWarnings,
      sectorProfile,
    });
  } catch {
    return NextResponse.json({ hasPriorBids: false, profile: null, recentInsights: [], lossWarnings: [], sectorProfile: null });
  }
}
