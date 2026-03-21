export const maxDuration = 120;

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const bHeaders = { 'Authorization': `Bearer ${BUBBLE_API_KEY}`, 'Content-Type': 'application/json' };

const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface QuestionReport {
  question_number: string;
  question_text: string;
  answer_text: string;
  bid_score: number | null;
  bid_score_max: number | null;
  evaluator_comment: string | null;
  sentiment: 'positive' | 'negative' | 'neutral';
  score_awarded: number | null;
  score_max: number | null;
  improvement: string | null;
  resonant_phrase: string | null;
}

export async function POST(req: Request) {
  try {
    const { outcomeId } = await req.json();
    if (!outcomeId) {
      return NextResponse.json({ error: 'Missing outcomeId' }, { status: 400 });
    }

    // Fetch the Bid_Outcome record
    const outcomeRes = await fetch(`${BUBBLE_API_BASE}/Bid_Outcome/${outcomeId}`, { headers: bHeaders });
    if (!outcomeRes.ok) {
      return NextResponse.json({ error: 'Outcome not found' }, { status: 404 });
    }
    const outcomeData = await outcomeRes.json();
    const outcome = outcomeData.response;

    const tenderId: string | null = outcome.tender || null;
    const feedbackRaw: string | null = outcome.feedback_raw || null;
    const tenderName: string = outcome.tender_name || 'Unknown Tender';
    const buyerName: string = outcome.buyer_name || 'Unknown Buyer';
    const outcomeResult: string = outcome.outcome || 'unknown';

    // Fetch Q&As if tender linked
    let questions: any[] = [];
    if (tenderId) {
      const constraints = JSON.stringify([{ key: 'tender', constraint_type: 'equals', value: tenderId }]);
      const qRes = await fetch(
        `${BUBBLE_API_BASE}/tender_questions?constraints=${encodeURIComponent(constraints)}&limit=50&sort_field=question_number`,
        { headers: bHeaders }
      );
      if (qRes.ok) {
        const qData = await qRes.json();
        questions = (qData.response?.results || []).filter((q: any) => q.answer_text && q.answer_text.length > 20);
      }
    }

    if (questions.length === 0 && !feedbackRaw) {
      return NextResponse.json({ questions: [], tenderName, buyerName, outcomeResult, hasFeedback: false, hasQuestions: false });
    }

    if (questions.length === 0) {
      // No Q&As linked — return feedback only mode
      return NextResponse.json({ questions: [], tenderName, buyerName, outcomeResult, feedbackRaw, hasFeedback: !!feedbackRaw, hasQuestions: false });
    }

    // Build Q&A block for Claude
    const qaBlock = questions
      .map(q => {
        const scoreMatch = (q.final_evaluation || '').match(/Overall Score:\s*(\d+\.?\d*)\/(\d+)/i)
          || (q.final_evaluation || '').match(/Overall Score:\s*(\d+\.?\d*)/i);
        const score = scoreMatch ? `[BidScore: ${scoreMatch[1]}${scoreMatch[2] ? `/${scoreMatch[2]}` : '/10'}]` : '';
        return `Q${q.question_number}: ${q.question_text}\nANSWER ${score}:\n${q.answer_text?.slice(0, 1200)}`;
      })
      .join('\n\n---\n\n');

    const prompt = `You are analysing evaluator feedback against the actual bid answers submitted for a ${outcomeResult.toUpperCase()} outcome.

TENDER: ${tenderName}
BUYER: ${buyerName}
OUTCOME: ${outcomeResult.toUpperCase()}

BID ANSWERS SUBMITTED:
${qaBlock}

EVALUATOR FEEDBACK:
${feedbackRaw || 'No feedback provided.'}

For EACH question above, produce a JSON object. Cross-reference the evaluator feedback with the specific answer. If the feedback clearly refers to this question's topic, extract the relevant comment. If not clearly referenced, set evaluator_comment to null.

Each object must have exactly these fields:
- question_number: the Q number as a string (e.g. "1", "2")
- question_text: the full question text
- answer_text: the first 300 chars of the answer submitted
- bid_score: number extracted from [BidScore: X] tag, or null
- bid_score_max: the max score from the tag (default 10 if tag found without max), or null
- evaluator_comment: exact 1-3 sentence quote from the evaluator feedback relevant to this question/topic, or null
- sentiment: "positive" if scored well or praised, "negative" if scored poorly or criticised, "neutral" if unclear
- score_awarded: numeric score the evaluator gave for this question/topic if mentioned, else null
- score_max: max score for this question if mentioned, else null
- improvement: if negative/neutral, specific content that was missing or should be improved, else null
- resonant_phrase: if positive, the exact phrase from the answer that likely resonated with the evaluator, else null

Return ONLY a valid JSON array of ${questions.length} objects. No markdown. No explanation.`;

    const response = await anthropicClient.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';
    let report: QuestionReport[] = [];
    try {
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      report = JSON.parse(cleaned);
    } catch {
      report = [];
    }

    return NextResponse.json({
      questions: report,
      tenderName,
      buyerName,
      outcomeResult,
      feedbackRaw,
      hasFeedback: !!feedbackRaw,
      hasQuestions: questions.length > 0,
    });
  } catch (e: any) {
    console.error('outcome-report error:', e);
    return NextResponse.json({ error: 'Report generation failed', detail: e?.message }, { status: 500 });
  }
}
