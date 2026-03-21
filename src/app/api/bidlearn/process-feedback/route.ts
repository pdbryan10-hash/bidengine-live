import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { EVIDENCE_CATEGORIES } from '@/lib/bubble';

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '33cb561a966f59ad7ea5e29a1906bf36';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const bHeaders = { 'Authorization': `Bearer ${BUBBLE_API_KEY}`, 'Content-Type': 'application/json' };

const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CATEGORY_KEYS = EVIDENCE_CATEGORIES.map(c => c.category);

export async function POST(req: Request) {
  try {
    const { outcomeId, client: clientId, buyer_name, tender_name, tender_id, outcome, feedback_raw, buyer_org_type } = await req.json();

    if (!outcomeId || !feedback_raw) {
      return NextResponse.json({ error: 'Missing outcomeId or feedback_raw' }, { status: 400 });
    }

    // Fetch Q&As from BidWrite if tender_id is available
    let qaBlock = '';
    if (tender_id) {
      try {
        const constraints = JSON.stringify([{ key: 'tender', constraint_type: 'equals', value: tender_id }]);
        const qRes = await fetch(
          `${BUBBLE_API_BASE}/tender_questions?constraints=${encodeURIComponent(constraints)}&limit=50`,
          { headers: bHeaders }
        );
        if (qRes.ok) {
          const qData = await qRes.json();
          const questions: any[] = qData.response?.results || [];
          if (questions.length > 0) {
            qaBlock = `\n\nBIDWRITE Q&A SUBMITTED FOR THIS TENDER:\n${questions
              .filter(q => q.answer_text && q.answer_text.length > 20)
              .map(q => {
                const scoreMatch = (q.final_evaluation || '').match(/Overall Score:\s*(\d+\.?\d*)/i);
                const score = scoreMatch ? ` [BidScore: ${scoreMatch[1]}/10]` : '';
                return `Q${q.question_number || ''}: ${q.question_text}\nANSWER${score}:\n${q.answer_text?.slice(0, 800)}`;
              })
              .join('\n\n---\n\n')}`;
          }
        }
      } catch {
        // Non-fatal — continue without Q&As
      }
    }

    const prompt = `You are analysing evaluator feedback from a public sector tender bid${qaBlock ? ' alongside the actual answers submitted' : ''}.

OUTCOME: ${outcome}
BUYER: ${buyer_name}
TENDER: ${tender_name}
${qaBlock}

EVALUATOR FEEDBACK:
${feedback_raw}

${qaBlock ? `Cross-reference the evaluator feedback against the actual answers submitted. Identify which specific answers or phrases led to positive/negative scores. Extract category-level insights.` : 'Extract category-level insights from the evaluator feedback.'}

Each object must have:
- evidence_category: one of [${CATEGORY_KEYS.join(', ')}]
- sentiment: "positive", "negative", or "neutral"
- score_awarded: number or null (from feedback)
- score_max: number or null (from feedback)
- feedback_excerpt: exact 1-3 sentences from the evaluator feedback about this category
- resonant_phrase: if positive, the exact phrase from the ANSWER that scored well — otherwise null
- improvement_note: if negative/neutral, what specific content was missing from the answer — otherwise null

Return ONLY valid JSON array. No markdown. No explanation.`;

    const response = await anthropicClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';
    let insights: Record<string, unknown>[] = [];
    try {
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      insights = JSON.parse(cleaned);
    } catch {
      insights = [];
    }

    // Write each insight to Bubble
    await Promise.all(
      insights.map((ins) =>
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
              ? Math.round((Number(ins.score_awarded) / Number(ins.score_max)) * 100)
              : 70,
            ...(buyer_org_type && { org_type: buyer_org_type }),
          }),
        }).catch(() => {})
      )
    );

    // Mark outcome as processed
    await fetch(`${BUBBLE_API_BASE}/Bid_Outcome/${outcomeId}`, {
      method: 'PATCH',
      headers: bHeaders,
      body: JSON.stringify({ feedback_processed: 'true' }),
    }).catch(() => {});

    // Fire and forget buyer profile update
    const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    fetch(`${baseUrl}/api/bidlearn/update-buyer-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, buyer_name }),
    }).catch(() => {});

    return NextResponse.json({ success: true, insights });
  } catch (e: any) {
    console.error('process-feedback error:', e);
    return NextResponse.json({ error: 'Processing failed', detail: e?.message }, { status: 500 });
  }
}
