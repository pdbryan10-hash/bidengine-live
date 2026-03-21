import { NextResponse } from 'next/server';

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';

export async function POST(req: Request) {
  try {
    const { clientId, buyerName, aiScore } = await req.json();
    if (!clientId || !aiScore) return NextResponse.json({ adjustment: 0, adjustedScore: aiScore, reasoning: [] });

    const bHeaders = { 'Authorization': `Bearer ${BUBBLE_API_KEY}` };

    // Fetch buyer profile and insights in parallel
    const [profileRes, insightsRes, sectorRes] = await Promise.all([
      buyerName ? fetch(`${BUBBLE_API_BASE}/Buyer_Profile?constraints=${encodeURIComponent(JSON.stringify([
        { key: 'client', constraint_type: 'equals', value: clientId },
        { key: 'buyer_name', constraint_type: 'equals', value: buyerName }
      ]))}&limit=1`, { headers: bHeaders }) : Promise.resolve(null),
      buyerName ? fetch(`${BUBBLE_API_BASE}/Outcome_Insight?constraints=${encodeURIComponent(JSON.stringify([
        { key: 'client', constraint_type: 'equals', value: clientId },
        { key: 'buyer_name', constraint_type: 'equals', value: buyerName },
        { key: 'insight_type', constraint_type: 'equals', value: 'weakness' }
      ]))}&limit=50`, { headers: bHeaders }) : Promise.resolve(null),
      Promise.resolve(null) // sector fetched separately if needed
    ]);

    const profile = profileRes?.ok ? (await profileRes.json()).response?.results?.[0] : null;
    const weaknesses: any[] = insightsRes?.ok ? (await insightsRes.json()).response?.results || [] : [];

    const reasoning: string[] = [];
    let adjustment = 0;

    // Apply adjustments based on historical data
    if (profile) {
      const winRate = profile.win_rate || 0;
      // Penalise if low win rate with this buyer
      if (winRate < 30 && profile.total_bids >= 2) {
        adjustment -= 0.4;
        reasoning.push(`Low win rate (${winRate.toFixed(0)}%) with ${buyerName} — historical risk`);
      } else if (winRate < 50 && profile.total_bids >= 3) {
        adjustment -= 0.2;
        reasoning.push(`Below average win rate (${winRate.toFixed(0)}%) with ${buyerName}`);
      }
    }

    // Penalise per repeated category weakness
    const catCounts: Record<string, number> = {};
    weaknesses.forEach((w: any) => {
      const cat = w.category || w.evidence_category || 'General';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    Object.entries(catCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .forEach(([cat, count]) => {
        if (count >= 2) {
          adjustment -= 0.2;
          reasoning.push(`${count} previous losses on ${cat} with this buyer`);
        }
      });

    // Cap adjustment
    adjustment = Math.max(-1.5, Math.min(0.5, adjustment));
    const adjustedScore = Math.min(10, Math.max(0, aiScore + adjustment));

    return NextResponse.json({
      adjustment: Math.round(adjustment * 10) / 10,
      adjustedScore: Math.round(adjustedScore * 10) / 10,
      reasoning,
      buyerProfile: profile ? {
        winRate: profile.win_rate,
        totalBids: profile.total_bids,
        wins: profile.wins
      } : null
    });
  } catch {
    return NextResponse.json({ adjustment: 0, adjustedScore: 0, reasoning: [] });
  }
}
