import Anthropic from '@anthropic-ai/sdk';
import { EVIDENCE_CATEGORIES } from '@/lib/bubble';

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const bHeaders = { 'Authorization': `Bearer ${BUBBLE_API_KEY}`, 'Content-Type': 'application/json' };
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CATEGORY_KEYS = EVIDENCE_CATEGORIES.map(c => c.category);

export async function processFeedbackAndUpdateProfile(params: {
  outcomeId: string;
  clientId: string;
  buyer_name: string;
  tender_name: string;
  tender_id?: string;
  outcome: string;
  feedback_raw: string;
  buyer_org_type?: string;
}) {
  const { outcomeId, clientId, buyer_name, tender_name, tender_id, outcome, feedback_raw, buyer_org_type } = params;

  // Fetch Q&As from BidWrite if tender linked
  let qaBlock = '';
  if (tender_id) {
    try {
      const constraints = JSON.stringify([{ key: 'tender', constraint_type: 'equals', value: tender_id }]);
      const qRes = await fetch(
        `${BUBBLE_API_BASE}/tender_questions?constraints=${encodeURIComponent(constraints)}&limit=50`,
        { headers: bHeaders }
      );
      if (qRes.ok) {
        const questions: Record<string, unknown>[] = (await qRes.json()).response?.results || [];
        if (questions.length > 0) {
          qaBlock = `\n\nBIDWRITE Q&A SUBMITTED:\n${questions
            .filter(q => q.answer_text && (q.answer_text as string).length > 20)
            .map(q => {
              const scoreMatch = ((q.final_evaluation as string) || '').match(/Overall Score:\s*(\d+\.?\d*)/i);
              const score = scoreMatch ? ` [BidScore: ${scoreMatch[1]}/10]` : '';
              return `Q${q.question_number || ''}: ${q.question_text}\nANSWER${score}:\n${(q.answer_text as string)?.slice(0, 800)}`;
            })
            .join('\n\n---\n\n')}`;
        }
      }
    } catch { /* non-fatal */ }
  }

  const prompt = `You are analysing evaluator feedback from a public sector tender bid${qaBlock ? ' alongside the actual answers submitted' : ''}.

OUTCOME: ${outcome}
BUYER: ${buyer_name}
TENDER: ${tender_name}
${qaBlock}

EVALUATOR FEEDBACK:
${feedback_raw}

Extract category-level insights. Each object must have:
- evidence_category: one of [${CATEGORY_KEYS.join(', ')}]
- sentiment: "positive", "negative", or "neutral"
- score_awarded: number or null
- score_max: number or null
- feedback_excerpt: exact 1-3 sentences from evaluator feedback about this category
- resonant_phrase: if positive, exact phrase from the answer that scored well — else null
- improvement_note: if negative/neutral, what specific content was missing — else null

Return ONLY valid JSON array. No markdown. No explanation.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';
  let insights: Record<string, unknown>[] = [];
  try {
    insights = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
  } catch { insights = []; }

  // Write insights to Bubble
  await Promise.all(insights.map(ins =>
    fetch(`${BUBBLE_API_BASE}/Outcome_Insight`, {
      method: 'POST',
      headers: bHeaders,
      body: JSON.stringify({
        client_id: clientId,
        bid_outcome_id: outcomeId,
        buyer_name,
        category: ins.evidence_category,
        insight_type: ins.sentiment,
        insight_text: ins.feedback_excerpt || '',
        confidence: ins.score_awarded && ins.score_max
          ? Math.round((Number(ins.score_awarded) / Number(ins.score_max)) * 100) : 70,
        ...(buyer_org_type && { org_type: buyer_org_type }),
      }),
    }).catch(() => {})
  ));

  // Mark outcome as feedback_processed
  await fetch(`${BUBBLE_API_BASE}/Bid_Outcome/${outcomeId}`, {
    method: 'PATCH',
    headers: bHeaders,
    body: JSON.stringify({ feedback_processed: 'true' }),
  }).catch(() => {});

  // Update Buyer_Profile
  await updateBuyerProfile(clientId, buyer_name);
}

async function updateBuyerProfile(clientId: string, buyer_name: string) {
  const [outcomesRes, insightsRes] = await Promise.all([
    fetch(`${BUBBLE_API_BASE}/Bid_Outcome?constraints=${encodeURIComponent(JSON.stringify([
      { key: 'client', constraint_type: 'equals', value: clientId },
      { key: 'buyer_name', constraint_type: 'equals', value: buyer_name },
    ]))}&limit=100&sort_field=Created%20Date&descending=true`, { headers: bHeaders }),
    fetch(`${BUBBLE_API_BASE}/Outcome_Insight?constraints=${encodeURIComponent(JSON.stringify([
      { key: 'client_id', constraint_type: 'equals', value: clientId },
      { key: 'buyer_name', constraint_type: 'equals', value: buyer_name },
    ]))}&limit=200`, { headers: bHeaders }),
  ]);

  const outcomes: Record<string, unknown>[] = outcomesRes.ok ? (await outcomesRes.json()).response?.results || [] : [];
  const insights: Record<string, unknown>[] = insightsRes.ok ? (await insightsRes.json()).response?.results || [] : [];

  const wins = outcomes.filter(o => o.outcome === 'win').length;
  const losses = outcomes.filter(o => o.outcome === 'loss').length;
  const win_rate = outcomes.length > 0 ? wins / outcomes.length : 0;
  const last = outcomes[0];

  const winIds = new Set(outcomes.filter(o => o.outcome === 'win').map(o => o._id as string));
  const catScore: Record<string, number> = {};
  insights.forEach(ins => {
    const cat = ins.category as string;
    if (!catScore[cat]) catScore[cat] = 0;
    if (ins.insight_type === 'positive' && winIds.has(ins.bid_outcome_id as string)) catScore[cat] += 2;
    if (ins.insight_type === 'negative') catScore[cat] -= 1;
  });
  const sorted = Object.entries(catScore).sort((a, b) => b[1] - a[1]);
  const strong = sorted.filter(([, s]) => s > 0).slice(0, 3).map(([c]) => c).join(', ');
  const weak = sorted.filter(([, s]) => s < 0).slice(0, 3).map(([c]) => c).join(', ');

  const resonantPhrases = insights
    .filter(i => i.resonant_phrase)
    .map(i => i.resonant_phrase as string)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 10);

  const improvementNotes = insights.filter(i => i.improvement_note).map(i => i.improvement_note as string).slice(0, 5).join('. ');

  let profile_summary = '';
  try {
    const aiRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: `Summarise what this buyer values based on bid history in 3-4 sentences. Be specific and actionable.\n\nBUYER: ${buyer_name}\nWIN RATE: ${Math.round(win_rate * 100)}% (${wins}/${outcomes.length})\nSTRONG: ${strong || 'insufficient data'}\nWEAK: ${weak || 'insufficient data'}\nRESONANT: ${resonantPhrases.slice(0, 5).join(', ') || 'none'}\n\nReturn only the summary paragraph.` }],
    });
    profile_summary = aiRes.content[0].type === 'text' ? aiRes.content[0].text.trim() : '';
  } catch { /* non-fatal */ }

  const payload = {
    client_id: clientId, buyer_name,
    buyer_org_type: (last?.buyer_org_type as string) || '',
    total_bids: outcomes.length, wins, losses, win_rate,
    last_outcome: (last?.outcome as string) || '',
    strong_categories: strong, weak_categories: weak,
    resonant_phrases: JSON.stringify(resonantPhrases),
    evaluator_priorities: improvementNotes,
    profile_summary, profile_updated: new Date().toISOString(),
  };

  const existingRes = await fetch(`${BUBBLE_API_BASE}/Buyer_Profile?constraints=${encodeURIComponent(JSON.stringify([
    { key: 'client_id', constraint_type: 'equals', value: clientId },
    { key: 'buyer_name', constraint_type: 'equals', value: buyer_name },
  ]))}&limit=1`, { headers: bHeaders });
  const existing = existingRes.ok ? (await existingRes.json()).response?.results?.[0] : null;

  if (existing) {
    await fetch(`${BUBBLE_API_BASE}/Buyer_Profile/${existing._id}`, { method: 'PATCH', headers: bHeaders, body: JSON.stringify(payload) });
  } else {
    await fetch(`${BUBBLE_API_BASE}/Buyer_Profile`, { method: 'POST', headers: bHeaders, body: JSON.stringify(payload) });
  }
}
