import { NextRequest, NextResponse } from 'next/server';
import { callClaude, estimateTokens } from '@/lib/claude';

export const maxDuration = 120;

// @ts-ignore
const pdf = require('pdf-parse');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileBase64, chunkIndex, existingNumbers } = body;

    // If fileBase64 provided, extract text first then chunk
    if (fileBase64 !== undefined && chunkIndex === undefined) {
      const buffer = Buffer.from(fileBase64, 'base64');
      const data = await pdf(buffer);
      return NextResponse.json({ text: data.text });
    }

    // Otherwise score a chunk of text
    const { text } = body;
    if (!text) return NextResponse.json({ pairs: [] });

    const existingNums: string[] = existingNumbers || [];

    const prompt = `You are extracting question-and-answer pairs from a completed tender submission document.

This document contains both the QUESTIONS asked and the ANSWERS the bidder has written.

Extract every question-answer pair you can find. Each question will typically be followed by the bidder's written response.

CRITICAL RULES:
1. You MUST capture the COMPLETE answer_text — every single word the bidder wrote for that question. Do NOT truncate, summarise, or cut short any answer. If an answer is 2000 words, return all 2000 words.
2. If an answer appears to be cut off at the end of this text section (mid-sentence, mid-paragraph), still include everything you can see — the deduplication system will handle merging.
3. Never paraphrase or shorten — return the bidder's EXACT text.

${existingNums.length > 0 ? `Already found these question numbers — skip them entirely: ${existingNums.join(', ')}` : ''}

Return a JSON array only, no other text. Each object must have:
- question_number: string (e.g. "Q1", "1.1", "A")
- question_text: string (the full question being asked)  
- answer_text: string (the bidder's COMPLETE written response — every word, no truncation)
- section: string (section name or "General")
- word_limit: number or null
- weighting: string or null

If a question has no visible answer, set answer_text to "".
If no pairs found in this section, return [].

Document section:

${text}`;

    const message = await callClaude(
      [{ role: 'user', content: prompt }],
      {
        maxTokens: 16000,
        model: 'claude-haiku-4-5-20251001',
        estimatedInputTokens: estimateTokens(prompt),
        temperature: 0.1,
      }
    );

    const content = message.content[0];
    const responseText = content.type === 'text' ? content.text : '';

    let jsonStr = responseText;
    if (responseText.includes('```')) {
      jsonStr = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const pairs = JSON.parse(jsonStr);
    return NextResponse.json({ pairs: Array.isArray(pairs) ? pairs : [] });

  } catch (error: any) {
    console.error('BidCheck extract error:', error);
    return NextResponse.json({ pairs: [] });
  }
}
