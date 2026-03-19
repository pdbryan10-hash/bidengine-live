import { NextRequest, NextResponse } from 'next/server';
import { callClaude, estimateTokens } from '@/lib/claude';

export const maxDuration = 60;

function extractBullets(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split('\n')
    .map((l: string) => l.replace(/^[-*•✓✗]\s*/, '').trim())
    .filter((l: string) => l.length > 5 && !l.startsWith('#') && !l.startsWith('**'));
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const { question_id, question_number, question_text, answer_text, section, word_limit, weighting } = await request.json();

    if (!question_text) {
      return NextResponse.json({ error: 'Missing question_text' }, { status: 400 });
    }

    if (!answer_text || answer_text.trim().length < 20) {
      return NextResponse.json({
        success: true,
        question_id,
        score: 0,
        mustFix: 'No answer was found in the document for this question.',
        shouldFix: '',
        niceToHave: '',
        quickWin: 'Write a response that directly addresses each part of the question with specific evidence.',
        strengths: [],
        compliance: [],
        primaryGap: 'No answer provided',
        scorePotential: 'No answer found — a well-evidenced response could score 8–9.',
      });
    }

    const context = [
      `Question ${question_number || ''}${section ? ` — ${section}` : ''}`,
      word_limit ? `Word limit: ${word_limit}` : null,
      weighting ? `Weighting: ${weighting}` : null,
    ].filter(Boolean).join(' | ');

    const prompt = `You are a senior UK public sector tender evaluator conducting a pre-submission quality gate review.

Score this answer EXACTLY as a real evaluation panel would using UK public procurement scoring methodology.

CRITICAL SCORING CALIBRATION:
- An answer that addresses ALL sub-questions with named client evidence, quantified outcomes, and clear structure is STRONG (8.5–9.2)
- An answer that addresses most sub-questions with evidence but has minor structural gaps (e.g. missing governance detail, no explicit KPIs) is GOOD (8.0–8.5)
- An answer that addresses the question but with generic/unverified claims or missing sub-questions is ADEQUATE (7.0–7.9)
- An answer with significant gaps, no evidence, or major sub-questions ignored is WEAK (5.0–6.9)

SCORING RULES — Start at 10.0 and deduct:
- Sub-question completely unanswered: -1.0
- Sub-question answered but with no supporting evidence: -0.5
- Claims made without named client/project reference: -0.3
- Vague language where specifics were available: -0.2
- Banned word (leverage, synergy, holistic, bespoke, paradigm, seamless, cutting-edge, best-in-class, world-class): -0.1 each
- Missing governance/monitoring detail (minor structural gap): -0.2
- Missing repeatability/framework detail (minor structural gap): -0.2

DO NOT over-penalise:
- If the bidder provides named projects with evidence IDs, treat these as verified evidence — do not deduct for "unverified claims"
- If all sub-questions are addressed with evidence, the floor score is 8.0 regardless of structural preferences
- Missing governance frameworks or KPIs are IMPROVEMENTS not CRITICAL GAPS when the core answer is evidence-backed
- An answer scoring 8.7 in BidEngine should score 8.5–9.0 here, not 7.2

CRITICAL — AVOID REPETITION OF STRUCTURAL OBSERVATIONS:
- "Missing governance", "missing KPIs", "missing repeatability framework", "missing monitoring" are STRUCTURAL observations, not content gaps
- If governance/monitoring/repeatability is missing, mention it ONCE in Should Fix with a single concrete suggestion. Do NOT repeat it in Must Fix, Could Fix, or Compliance
- Must Fix is ONLY for: unanswered sub-questions, completely unsubstantiated claims, or banned words. Structural preferences like governance frameworks are NEVER Must Fix
- Could Fix is for genuinely different improvements — not restating governance in different words
- Compliance Check should mark sub-questions as ✓ or ✗ based on WHETHER THEY WERE ANSWERED, not whether governance was mentioned
- Focus feedback on CONTENT-SPECIFIC improvements unique to each question, not boilerplate structural observations that apply to every tender answer

---

${context}

QUESTION:
${question_text}

---

BIDDER'S ANSWER:
${answer_text}

---

## OUTPUT FORMAT (follow exactly)

## Overall Score: X.X/10
[One sentence explaining the score with reference to something specific they wrote]

## Primary Gap: [5 words max — the single biggest improvement opportunity]

## Score Potential: [One sentence — e.g. "This answer scores 8.5. Adding explicit governance KPIs and a compliance calendar could push it to 9.0–9.5."]

---

## What Was Done Well
- [specific strength from their answer]
- [another specific strength]

---

## Must Fix
[Only genuine problems — missing sub-questions or unsubstantiated claims. Reference what they wrote.]

---

## Should Fix
[Improvements that would strengthen the answer. Reference their actual text.]

---

## Could Fix
[Nice-to-haves that would push towards 9.5+]

---

## Compliance Check
- ✓ [requirement they addressed with evidence]
- ✗ [requirement they missed or addressed without evidence]`;

    const message = await callClaude(
      [{ role: 'user', content: prompt }],
      {
        maxTokens: 3000,
        model: 'claude-haiku-4-5-20251001',
        estimatedInputTokens: estimateTokens(prompt),
        temperature: 0.2,
      }
    );

    const content = message.content[0];
    const evaluation = content.type === 'text' ? content.text : '';

    const scoreMatch = evaluation.match(/Overall Score:\s*(\d+\.?\d*)/i);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 7.0;

    const mustFixMatch = evaluation.match(/## Must Fix\n([\s\S]*?)(?=##|$)/i);
    const shouldFixMatch = evaluation.match(/## Should Fix\n([\s\S]*?)(?=##|$)/i);
    const couldFixMatch = evaluation.match(/## Could Fix\n([\s\S]*?)(?=##|$)/i);
    const strengthsMatch = evaluation.match(/## What Was Done Well\n([\s\S]*?)(?=##|$)/i);
    const complianceMatch = evaluation.match(/## Compliance Check\n([\s\S]*?)(?=##|$)/i);
    const primaryGapMatch = evaluation.match(/## Primary Gap:\s*([^\n]+)/i);
    const scorePotentialMatch = evaluation.match(/## Score Potential:\s*([^\n]+)/i);

    const mustFix = mustFixMatch ? mustFixMatch[1].trim() : '';
    const quickWin = mustFix && mustFix.length > 10
      ? mustFix.split('\n').filter((l: string) => l.trim().length > 5)[0]?.replace(/^[-*•]\s*/, '').trim() || ''
      : 'Strong answer — add more specific evidence to push towards 9+.';

    return NextResponse.json({
      success: true,
      question_id,
      score,
      evaluation,
      mustFix,
      shouldFix: shouldFixMatch ? shouldFixMatch[1].trim() : '',
      niceToHave: couldFixMatch ? couldFixMatch[1].trim() : '',
      quickWin,
      strengths: extractBullets(strengthsMatch?.[1]),
      compliance: extractBullets(complianceMatch?.[1]),
      primaryGap: primaryGapMatch ? primaryGapMatch[1].trim() : '',
      scorePotential: scorePotentialMatch ? scorePotentialMatch[1].trim() : '',
    });

  } catch (error: any) {
    console.error('BidCheck score error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
