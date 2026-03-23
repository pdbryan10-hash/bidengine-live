export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '33cb561a966f59ad7ea5e29a1906bf36';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const bHeaders = { 'Authorization': `Bearer ${BUBBLE_API_KEY}`, 'Content-Type': 'application/json' };
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientId, tenderId, tenderName, originalDraft, fileBase64, fileName } = body;

    if (!clientId || !tenderId || !originalDraft || !fileBase64 || !fileName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Extract text from uploaded file
    const buffer = Buffer.from(fileBase64, 'base64');
    const ext = fileName.toLowerCase().split('.').pop();
    let finalDraft = '';

    if (ext === 'pdf') {
      const data = await pdfParse(buffer);
      finalDraft = data.text;
    } else if (ext === 'docx' || ext === 'doc') {
      const result = await mammoth.extractRawText({ buffer });
      finalDraft = result.value;
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF or Word.' }, { status: 400 });
    }

    if (!finalDraft.trim()) {
      return NextResponse.json({ error: 'Could not extract text from file' }, { status: 400 });
    }

    // Run Claude comparison
    const prompt = `You are analysing the difference between an AI-generated bid first draft and a human-polished final version for a UK public sector bid.

TENDER: ${tenderName}

AI FIRST DRAFT:
${originalDraft.slice(0, 7000)}

HUMAN FINAL VERSION:
${finalDraft.slice(0, 7000)}

Analyse what the human improved. Return a JSON object with exactly these fields:
{
  "summary": "2-3 sentence summary of the key improvements made",
  "additions": ["list of specific things added or expanded"],
  "deletions": ["list of specific things removed or shortened"],
  "evidence_inserted": true or false,
  "quantification_added": true or false,
  "compliance_strengthened": true or false,
  "tone_change": "more formal / more direct / more concise / same",
  "structure_change": "description of structural changes, or 'none'",
  "style_signals": ["3-5 signals about how this workspace writes winning bids"],
  "improvement_score": a number from 1 to 10 rating how much better the final version is,
  "word_delta": integer (positive = words added, negative = words removed),
  "evidence_candidates": [
    {
      "title": "short label for this evidence (5-10 words, e.g. '8-week mobilisation with zero disruption')",
      "value": "the exact reusable fact, metric, or claim verbatim from the final draft",
      "type": one of: "metric" | "case_study" | "mobilisation" | "governance" | "compliance" | "process" | "social_value" | "staffing" | "accreditation",
      "reusability": "high" or "medium",
      "category": one of: "DELIVERY" | "EXPERIENCE" | "SOCIAL VALUE" | "GOVERNANCE" | "MOBILISATION" | "COMPLIANCE" | "STAFFING" | "OTHER",
      "client_name": "name of the client or organisation this evidence relates to, extracted from context, or null if not mentioned",
      "end_client_name": "name of the end client if different from client_name, or null",
      "sector": "sector this evidence relates to (e.g. Healthcare, Education, Local Government, Facilities Management), or null if not clear"
    }
  ]
}

For evidence_candidates: extract ONLY net-new factual content that appears in the HUMAN FINAL VERSION but NOT in the AI FIRST DRAFT. Focus on reusable proof points: quantified outcomes, named clients, mobilisation timescales, contract values, staffing numbers, retention figures, governance cadence, accreditations, system names, process steps, social value examples. Do NOT extract stylistic rewrites, filler, or buyer-specific one-off phrases. Return 0-6 candidates only. If nothing clearly reusable, return an empty array.

Return ONLY valid JSON. No markdown fences. No explanation.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
    let patterns: Record<string, any> = {};
    try {
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      patterns = JSON.parse(cleaned);
    } catch {
      patterns = { summary: 'Analysis complete — patterns stored.', additions: [], deletions: [], style_signals: [] };
    }

    // Store in Bubble
    const bubblePayload = {
      client: clientId,
      tender: tenderId,
      tender_name: tenderName,
      original_draft: originalDraft.slice(0, 10000),
      final_draft: finalDraft.slice(0, 10000),
      diff_summary: patterns.summary || '',
      patterns_extracted: JSON.stringify(patterns),
      word_delta: typeof patterns.word_delta === 'number' ? patterns.word_delta : 0,
      improvement_score: typeof patterns.improvement_score === 'number' ? patterns.improvement_score : 0,
    };

    const bubbleRes = await fetch(`${BUBBLE_API_BASE}/Refined_Draft`, {
      method: 'POST',
      headers: bHeaders,
      body: JSON.stringify(bubblePayload),
    });

    if (!bubbleRes.ok) {
      const bubbleErr = await bubbleRes.text().catch(() => '');
      console.error('Bubble save failed:', bubbleRes.status, bubbleErr);
      return NextResponse.json({ error: 'Failed to save to Bubble', detail: bubbleErr, status: bubbleRes.status }, { status: 500 });
    }

    const bubbleData = await bubbleRes.json();

    return NextResponse.json({
      success: true,
      refinedDraftId: bubbleData?.id,
      patterns,
      summary: patterns.summary,
    });
  } catch (e: any) {
    console.error('bidrefine upload error:', e);
    return NextResponse.json({ error: 'Upload failed', detail: e?.message }, { status: 500 });
  }
}
