import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';

const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchPaginated(url: string, limit = 200): Promise<Record<string, unknown>[]> {
  const allRecords: Record<string, unknown>[] = [];
  let cursor = 0;
  const pageSize = 100;
  const bHeaders = { 'Authorization': `Bearer ${BUBBLE_API_KEY}` };

  while (allRecords.length < limit) {
    const res = await fetch(`${url}&limit=${pageSize}&cursor=${cursor}`, { headers: bHeaders });
    if (!res.ok) break;
    const data = await res.json();
    const page: Record<string, unknown>[] = data.response?.results || [];
    const remaining: number = data.response?.remaining || 0;
    allRecords.push(...page);
    if (page.length < pageSize || remaining === 0) break;
    cursor += pageSize;
  }

  return allRecords.slice(0, limit);
}

export async function POST(req: Request) {
  try {
    const { org_type } = await req.json();

    if (!org_type) {
      return NextResponse.json({ error: 'Missing org_type' }, { status: 400 });
    }

    const orgTypeConstraint = encodeURIComponent(
      JSON.stringify([{ key: 'buyer_org_type', constraint_type: 'equals', value: org_type }])
    );
    const insightConstraint = encodeURIComponent(
      JSON.stringify([{ key: 'org_type', constraint_type: 'equals', value: org_type }])
    );

    const [outcomes, insights] = await Promise.all([
      fetchPaginated(`${BUBBLE_API_BASE}/Bid_Outcome?constraints=${orgTypeConstraint}`),
      fetchPaginated(`${BUBBLE_API_BASE}/Outcome_Insight?constraints=${insightConstraint}`),
    ]);

    // Win rate calculation
    const total = outcomes.length;
    const wins = outcomes.filter((o) => o.outcome === 'win').length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    // Group insights by category and sentiment
    const categoryMap: Record<string, { positive: number; negative: number; neutral: number }> = {};
    for (const ins of insights) {
      const cat = (ins.evidence_category as string) || 'Unknown';
      const sentiment = (ins.sentiment as string) || 'neutral';
      if (!categoryMap[cat]) categoryMap[cat] = { positive: 0, negative: 0, neutral: 0 };
      if (sentiment === 'positive') categoryMap[cat].positive++;
      else if (sentiment === 'negative') categoryMap[cat].negative++;
      else categoryMap[cat].neutral++;
    }

    const insightSummary = Object.entries(categoryMap)
      .map(([cat, counts]) => `${cat}: ${counts.positive} positive, ${counts.negative} negative, ${counts.neutral} neutral`)
      .join('\n');

    const claudePrompt = `You are analysing bid outcome patterns for the "${org_type}" buyer sector.

Win rate: ${winRate}% (${wins} wins from ${total} bids)

OUTCOME INSIGHTS by category:
${insightSummary || 'No insight data available yet.'}

Generate a sector intelligence profile. Respond in this exact JSON format:
{
  "profile_summary": "2-3 sentences describing what this buyer type values, their typical evaluation approach, and what differentiates winning bids",
  "common_strengths": "comma-separated list of categories/approaches that score well with this buyer type",
  "common_weaknesses": "comma-separated list of categories/approaches that typically lose marks with this buyer type",
  "scoring_patterns": "brief description of scoring patterns across categories"
}`;

    const claudeRes = await anthropicClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: claudePrompt }],
    });

    const raw = claudeRes.content[0].type === 'text' ? claudeRes.content[0].text.trim() : '{}';
    let profileData: Record<string, string> = {};
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      profileData = JSON.parse(cleaned);
    } catch {
      profileData = {
        profile_summary: raw.substring(0, 500),
        common_strengths: '',
        common_weaknesses: '',
        scoring_patterns: '',
      };
    }

    const bHeaders = { 'Authorization': `Bearer ${BUBBLE_API_KEY}`, 'Content-Type': 'application/json' };

    // Search for existing Sector_Profile with same org_type
    const searchConstraint = encodeURIComponent(
      JSON.stringify([{ key: 'org_type', constraint_type: 'equals', value: org_type }])
    );
    const searchRes = await fetch(`${BUBBLE_API_BASE}/Sector_Profile?constraints=${searchConstraint}&limit=1`, {
      headers: bHeaders,
    });

    const existingId: string | null = searchRes.ok
      ? (await searchRes.json()).response?.results?.[0]?._id || null
      : null;

    const payload = {
      org_type,
      win_rate: winRate,
      total_bids: total,
      profile_summary: profileData.profile_summary || '',
      common_strengths: profileData.common_strengths || '',
      common_weaknesses: profileData.common_weaknesses || '',
      scoring_patterns: profileData.scoring_patterns || '',
      last_updated: new Date().toISOString(),
    };

    if (existingId) {
      await fetch(`${BUBBLE_API_BASE}/Sector_Profile/${existingId}`, {
        method: 'PATCH',
        headers: bHeaders,
        body: JSON.stringify(payload),
      }).catch(() => {});
    } else {
      await fetch(`${BUBBLE_API_BASE}/Sector_Profile`, {
        method: 'POST',
        headers: bHeaders,
        body: JSON.stringify(payload),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, org_type, winRate, total, wins });
  } catch {
    return NextResponse.json({ error: 'Sector profile update failed' }, { status: 500 });
  }
}
