import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const bHeaders = { 'Authorization': `Bearer ${BUBBLE_API_KEY}`, 'Content-Type': 'application/json' };
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  try {
    const { client_id, buyer_name } = await req.json();
    if (!client_id || !buyer_name) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    // Fetch all outcomes for this buyer
    const outcomesConstraints = JSON.stringify([
      { key: 'client', constraint_type: 'equals', value: client_id },
      { key: 'buyer_name', constraint_type: 'equals', value: buyer_name },
    ]);
    const outcomesRes = await fetch(
      `${BUBBLE_API_BASE}/Bid_Outcome?constraints=${encodeURIComponent(outcomesConstraints)}&limit=100&sort_field=Created%20Date&descending=true`,
      { headers: bHeaders }
    );
    const outcomesData = outcomesRes.ok ? await outcomesRes.json() : { response: { results: [] } };
    const outcomes: Record<string, unknown>[] = outcomesData.response?.results || [];

    // Fetch all insights for this buyer
    const insightsConstraints = JSON.stringify([
      { key: 'client_id', constraint_type: 'equals', value: client_id },
      { key: 'buyer_name', constraint_type: 'equals', value: buyer_name },
    ]);
    const insightsRes = await fetch(
      `${BUBBLE_API_BASE}/Outcome_Insight?constraints=${encodeURIComponent(insightsConstraints)}&limit=200`,
      { headers: bHeaders }
    );
    const insightsData = insightsRes.ok ? await insightsRes.json() : { response: { results: [] } };
    const insights: Record<string, unknown>[] = insightsData.response?.results || [];

    // Compute stats
    const wins = outcomes.filter((o) => o.outcome === 'win').length;
    const losses = outcomes.filter((o) => o.outcome === 'loss').length;
    const total = outcomes.length;
    const win_rate = total > 0 ? wins / total : 0;
    const last = outcomes[0];

    // Compute strong/weak categories
    const winOutcomeIds = new Set(outcomes.filter((o) => o.outcome === 'win').map((o) => o._id as string));
    const catScore: Record<string, number> = {};
    insights.forEach((ins) => {
      const cat = ins.category as string;
      if (!catScore[cat]) catScore[cat] = 0;
      if (ins.insight_type === 'positive' && winOutcomeIds.has(ins.bid_outcome_id as string)) catScore[cat] += 2;
      if (ins.insight_type === 'negative') catScore[cat] -= 1;
    });
    const sorted = Object.entries(catScore).sort((a, b) => b[1] - a[1]);
    const strong = sorted.filter(([, s]) => s > 0).slice(0, 3).map(([c]) => c).join(', ');
    const weak = sorted.filter(([, s]) => s < 0).slice(0, 3).map(([c]) => c).join(', ');

    const resonantPhrases = insights
      .filter((i) => i.resonant_phrase)
      .map((i) => i.resonant_phrase as string)
      .filter((v, idx, arr) => arr.indexOf(v) === idx)
      .slice(0, 10);

    const improvementNotes = insights
      .filter((i) => i.improvement_note)
      .map((i) => i.improvement_note as string)
      .slice(0, 5)
      .join('. ');

    // Generate AI summary
    let profile_summary = '';
    if (outcomes.length > 0) {
      const summaryPrompt = `Summarise what this buyer values based on bid history in 3-4 sentences. Be specific and actionable.

BUYER: ${buyer_name}
WIN RATE: ${Math.round(win_rate * 100)}% (${wins}/${total} bids)
STRONG CATEGORIES: ${strong || 'insufficient data'}
WEAK CATEGORIES: ${weak || 'insufficient data'}
RESONANT PHRASES: ${resonantPhrases.slice(0, 5).join(', ') || 'none yet'}
IMPROVEMENT NOTES: ${improvementNotes || 'none yet'}

Return only the summary paragraph.`;

      const aiRes = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: summaryPrompt }],
      });
      profile_summary = aiRes.content[0].type === 'text' ? aiRes.content[0].text.trim() : '';
    }

    const profilePayload = {
      client_id,
      buyer_name,
      buyer_org_type: (last?.buyer_org_type as string) || '',
      total_bids: total,
      wins,
      losses,
      win_rate,
      last_outcome: (last?.outcome as string) || '',
      strong_categories: strong,
      weak_categories: weak,
      resonant_phrases: JSON.stringify(resonantPhrases),
      evaluator_priorities: improvementNotes,
      profile_summary,
      profile_updated: new Date().toISOString(),
    };

    // Check if profile exists
    const existingConstraints = JSON.stringify([
      { key: 'client_id', constraint_type: 'equals', value: client_id },
      { key: 'buyer_name', constraint_type: 'equals', value: buyer_name },
    ]);
    const existingRes = await fetch(
      `${BUBBLE_API_BASE}/Buyer_Profile?constraints=${encodeURIComponent(existingConstraints)}&limit=1`,
      { headers: bHeaders }
    );
    const existingData = existingRes.ok ? await existingRes.json() : null;
    const existing = existingData?.response?.results?.[0];

    if (existing) {
      await fetch(`${BUBBLE_API_BASE}/Buyer_Profile/${existing._id}`, {
        method: 'PATCH',
        headers: bHeaders,
        body: JSON.stringify(profilePayload),
      });
    } else {
      await fetch(`${BUBBLE_API_BASE}/Buyer_Profile`, {
        method: 'POST',
        headers: bHeaders,
        body: JSON.stringify(profilePayload),
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
