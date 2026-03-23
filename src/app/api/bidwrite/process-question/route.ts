export const maxDuration = 180;

import { NextRequest, NextResponse } from 'next/server';
import { callClaude, estimateTokens } from '@/lib/claude';
import {
  hybridSearch,
  EvidenceWithEmbedding,
  SemanticSearchResult
} from '@/lib/semantic';
import { fetchBuyerProfile, fetchOutcomeInsights, formatBuyerContextForPrompt } from '@/lib/bidlearn';

const BUBBLE_API_URL = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '33cb561a966f59ad7ea5e29a1906bf36';

// Enable/disable semantic search (can be toggled for testing)
const USE_SEMANTIC_SEARCH = true;
const SEMANTIC_TOP_K = 40; // Number of most relevant evidence records to use

// Fields to exclude from evidence (metadata we don't need)
const EXCLUDE_FIELDS = ['_id', 'Created Date', 'Modified Date', 'Created By', 'project_id', '_type', 'embedding'];

// Format a single evidence record nicely
function formatEvidenceRecord(record: any): string {
  const category = record.category || 'OTHER';
  const clientName = record.client_name || record.end_client_name || 'Unknown Client';
  const evidenceId = record._id;
  
  // Extract all meaningful fields
  const fields = Object.entries(record)
    .filter(([key, value]) => !EXCLUDE_FIELDS.includes(key) && value && String(value).trim())
    .map(([key, value]) => {
      const formattedKey = key.replace(/_/g, ' ');
      return `  ${formattedKey}: ${value}`;
    })
    .join('\n');
  
  return `[${category}] ${clientName} | ID: ${evidenceId}\n${fields}`;
}

// Format evidence with relevance score (for semantic search results)
function formatEvidenceWithRelevance(result: SemanticSearchResult): string {
  const record = result.evidence;
  const category = record.category || 'OTHER';
  const clientName = record.client_name || 'Unknown Client';
  const evidenceId = record._id;
  const relevance = (result.similarity * 100).toFixed(0);
  
  const fields = Object.entries(record)
    .filter(([key, value]) => !EXCLUDE_FIELDS.includes(key) && value && String(value).trim())
    .map(([key, value]) => {
      const formattedKey = key.replace(/_/g, ' ');
      return `  ${formattedKey}: ${value}`;
    })
    .join('\n');
  
  return `[${category}] ${clientName} | ID: ${evidenceId} | Relevance: ${relevance}%\n${fields}`;
}

// Fetch ALL evidence from single Project_Evidence table (with pagination)
async function fetchAllEvidence(clientId: string): Promise<any[]> {
  try {
    const constraints = JSON.stringify([
      { key: 'project_id', constraint_type: 'equals', value: clientId }
    ]);
    
    // Bubble API has a hard limit of 100 records per request - paginate
    const allRecords: any[] = [];
    let cursor = 0;
    const pageSize = 100;
    let hasMore = true;
    
    while (hasMore) {
      const response = await fetch(
        `${BUBBLE_API_URL}/Project_Evidence?constraints=${encodeURIComponent(constraints)}&limit=${pageSize}&cursor=${cursor}&sort_field=category&descending=false`,
        { headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` } }
      );
      
      if (!response.ok) break;
      
      const data = await response.json();
      const pageRecords = data.response?.results || [];
      const remaining = data.response?.remaining || 0;
      
      allRecords.push(...pageRecords);
      console.log(`Evidence fetch: cursor ${cursor}, got ${pageRecords.length}, remaining ${remaining}`);
      
      if (pageRecords.length < pageSize || remaining === 0) {
        hasMore = false;
      } else {
        cursor += pageSize;
      }
      
      // Safety limit
      if (cursor > 2000) break;
    }
    
    console.log('Total evidence records fetched:', allRecords.length);
    return allRecords;
  } catch (err) {
    console.error('Failed to fetch evidence:', err);
  }
  return [];
}

// Legacy function - fetch and format all evidence (no semantic search)
async function fetchEvidence(clientId: string): Promise<string> {
  const allRecords = await fetchAllEvidence(clientId);
  const allEvidence = allRecords.map((r: any) => formatEvidenceRecord(r)).join('\n\n---\n\n');
  
  // Claude can handle 200k context - use up to 80k for evidence
  console.log('Evidence chars:', allEvidence.length);
  return allEvidence.substring(0, 80000);
}

// NEW: Fetch evidence with semantic search - returns most relevant records for the question
async function fetchRelevantEvidence(clientId: string, questionText: string, tenderSector?: string): Promise<string> {
  const allRecords = await fetchAllEvidence(clientId);
  
  if (allRecords.length === 0) {
    return '';
  }
  
  console.log(`Semantic search: finding top ${SEMANTIC_TOP_K} relevant from ${allRecords.length} records...`);
  console.log(`Tender sector for prioritisation: ${tenderSector || 'Will auto-detect from question'}`);
  
  // Convert to format expected by semantic search
  const evidenceWithEmbeddings: EvidenceWithEmbedding[] = allRecords.map(r => ({
    _id: r._id,
    title: r.title || '',
    value: r.value || '',
    source_text: r.source_text || '',
    category: r.category || 'OTHER',
    client_name: r.client_name || r.end_client_name || 'Unknown',
    project_id: r.project_id,
    sector: r.sector || '', // Include sector for matching
    embedding: r.embedding ? JSON.parse(r.embedding) : undefined // If stored in Bubble
  }));
  
  // Run hybrid search (semantic + keyword boost + SECTOR BOOST)
  const results = await hybridSearch(questionText, evidenceWithEmbeddings, SEMANTIC_TOP_K, tenderSector);
  
  console.log(`Semantic search complete. Top relevance scores: ${results.slice(0, 5).map(r => (r.similarity * 100).toFixed(0) + '%').join(', ')}`);
  console.log(`Top 5 evidence sectors: ${results.slice(0, 5).map(r => r.evidence.sector || 'Unknown').join(', ')}`);
  
  // Format results with relevance scores
  const formatted = results.map(r => formatEvidenceWithRelevance(r)).join('\n\n---\n\n');
  
  console.log('Relevant evidence chars:', formatted.length);
  return formatted;
}

const BIDWRITE_PROMPT = `You are BidWrite, an expert bid writer winning UK public sector contracts. Write with authority — confident, specific, direct. You are informing a decision, not trying to impress. Never write "BidEngine" — always "we" or "our".

Before writing, silently identify: (1) the evaluator's primary concern for this question, (2) all sub-questions buried in the question, (3) the client's sector and its specific vocabulary. Do not include any of this analysis in your response.

=== OPENING TENSE ===

TYPE A — "How will you..." / "Describe your approach to..." / "Explain how you will..." / "Detail your approach to..."
→ Forward-looking question. Open with a future commitment: "We will deliver 100% statutory compliance through systematic PPM scheduling..."

TYPE B — "Provide evidence of..." / "Demonstrate how you achieved..." / "Give examples of..." / "What has been your performance..."
→ Evidence question. Lead with your strongest proven outcome in past or present tense.
→ WRONG: "Our ISO 45001 system will deliver zero RIDDOR incidents..." — future tense on an evidence question.
→ RIGHT: "Our ISO 45001-certified system has delivered zero RIDDOR reportable incidents, backed by 100% training compliance and 88 site safety audits in the last 12 months."
→ Verbs must be: "has delivered", "delivers", "achieved", "maintains". Never "will deliver" on a Type B question.

=== STRUCTURE ===

Bold headers on their own line for each sub-topic. Missing a sub-topic costs marks.

WRONG: "TUPE Transfer Management: Our approach involves..."
RIGHT:
**TUPE Transfer Management**
Our approach involves...

EQUAL DEPTH: Count the distinct requirements in the question. Give each roughly equal coverage — three paragraphs on electrical and one sentence on fire will lose marks every time.

Word count: 90-95% of any stated limit. If no limit, write 600-680 words.

=== CITATIONS ===

Use numbered citations [1], [2], [3] etc. in the body text. Do NOT embed the full ID inline.

CORRECT: "At NHS Acute Trust, we achieved 47 of 47 staff transferred with zero grievances [3]."
WRONG: "At NHS Acute Trust, we achieved 47 of 47 staff transferred [1770046912883x645627915755988600]."

Citations go on named-client sentences only:
"At [Client], we [achieved/delivered/maintained] [exact fact] [N]"

Do NOT attach a citation to a general "our approach" or "our process" statement.

CAPABILITY (no citation): "We conduct monthly compliance audits and weekly site reviews."
DELIVERY (citation required): "At NHS Acute Trust, we achieved 99.2% PPM completion [ID]."

EXACT REPRODUCTION: Copy numbers verbatim from the evidence. Never round, rephrase, or add context not in the record.
✗ Evidence: "47 staff transferred" → you write "47 staff across 6 hospital sites" — WRONG. Site count is not in the evidence.
✗ Evidence: "Asset validation of 4,620 assets" → you write "4,620 assets, PPM schedule build, and compliance calendar issued" — WRONG. Only cite what the evidence states. Write additional activities as capability (no citation).
✗ Evidence: "100% mandatory H&S training completion" → you write "100% training completion across our 142 M&E engineers and 58 electricians" — WRONG. Headcount and role breakdowns not in evidence. Write only "100% mandatory H&S training completion".
✗ Evidence: "980 safety observations" → you write "980 observations and 296 toolbox talks" — WRONG. Never pair a real stat with a made-up companion.

RIDDOR: Only claim "zero RIDDOR" if the evidence explicitly states zero. Never claim RIDDOR performance if the evidence doesn't mention it.

No number without evidence → remove the number, write capability language. No placeholders like [INSERT] or [TBC].

EVIDENCE GAPS: If asked for a specific metric you don't have, declare it: "We do not currently hold [metric] at contract level; we measure and report this during delivery." Silent gaps look like hiding. Declared gaps look like honesty.

Only cite evidence from the same service type — FM evidence does not prove catering performance.

If no sector match exists, bridge explicitly: "While our direct experience in [sector] includes [X], our approach in [comparable environment] directly translates because..."

Target 8-12 citations per response. Cite evidence at least once every 60-70 words.

=== EVIDENCE SELECTION ===

Lead with sector-matched evidence first. Apply standards from your own knowledge — you know the regulations for every service type. Do not invent standards. Do not cite standards from a different service type.

=== SECTOR LANGUAGE ===

Mirror the vocabulary of the sector in the question:
- Hard FM / Building Services: statutory compliance, PPM, CAFM, permit-to-work, asset criticality
- Healthcare: patient safety, infection control, HTM compliance, clinical continuity, CQC
- Education: term-time constraints, safeguarding, DBS, curriculum continuity
- Justice / Prisons: security protocols, HMPPS, enhanced vetting
- Commercial / Office: business continuity, tenant liaison, BREEAM, occupant experience
- Data Centres: uptime, N+1 redundancy, concurrent maintainability, Tier classification
- Catering / Food: HACCP, Food Standards Agency, allergen management
- IT / Digital / Cyber: ISO 27001, GDPR, ITIL, change management
- Waste / Environmental: duty of care, EA permits, waste hierarchy
- Transport / Fleet: DVSA, driver hours, O-licence
- Grounds / Horticulture: seasonal programmes, BS 7370, habitat management
- Manufacturing / Industrial: PUWER/LOLER, production continuity, shift patterns
- Highways / Civil: Chapter 8, NRSWA, reinstatement
- Drainage / Utilities: WaPUG, CCTV survey, hydraulic modelling
Apply the same logic to any sector not listed.

=== VOICE ===

- "We will deliver X" not "We will ensure X" or "We will maintain X" — use outcome verbs, not process verbs
- "We deliver X" not "We aim/strive to deliver X"
- "We will plan X" not "We can plan X"
- Never: leverage, synergy, holistic, bespoke, paradigm, seamless, utilise, facilitate, foster, cultivate, cutting-edge, best-in-class, world-class, industry-leading, strive, endeavour, passionate, meticulously, paramount, pivotal, streamlined
- If the question uses a banned word (e.g. "seamless service continuity"), do NOT echo it — substitute: "uninterrupted", "continuous", "consistent"

=== BUYER INTELLIGENCE ===

If a BUYER INTELLIGENCE block appears below, use it to sharpen the response:
- If win rate is high (60%+): lead with confidence — this buyer knows your work
- Prioritise evidence from the CATEGORIES THAT SCORE WELL list
- Address CATEGORIES THAT SCORE POORLY with extra evidence depth
- Apply WHAT THIS BUYER VALUES as a lens on which aspects to emphasise
- Treat WARNINGS as Must-Fix priorities — these are real past loss reasons

=== EVIDENCE TABLE ===

End your response with each cited record on its own line, in citation number order:
ID: [full_id] | Client Name | Key Fact

The citation numbers in the body [1], [2] etc. must correspond to the order of rows in this table — [1] is the first row, [2] is the second row, and so on.

One row per line. No markdown tables. No header row.`;

const BIDSCORE_PROMPT = `# BidScore v6.0 - UK Public Sector Bid Evaluation

You evaluate tender responses as a senior UK public sector evaluator would. You are looking for responses that will WIN, not just pass.

---

## SCORING TRUTH

Real evaluators give 8-9 to responses that meet requirements with evidence. They're looking for reasons to PASS, not fail.

**START AT 9.0** for any response that:
- Answers the question directly in the first sentence
- Has verified evidence citations with exact numbers from the evidence library
- Addresses ALL sub-questions
- Uses sector-appropriate language
- Professional, authoritative tone (not salesy)

Then ONLY deduct for genuine problems.

---

## SCORE MEANINGS

- **9.0-10:** Meets/exceeds all requirements with verified evidence and clear client understanding. THIS IS THE TARGET.
- **8.0-8.9:** Good response, minor issues — could win but not best in class.
- **7.0-7.9:** Adequate but gaps or weak evidence — risky in a competitive field.
- **Below 7:** Significant problems — likely to score poorly against competition.

---

## DEDUCTIONS (from 9.0 base)

- Fabricated/unverifiable stat (no matching evidence record) = -0.5
- Sub-question completely ignored = -0.5
- Sub-question addressed weakly/vaguely = -0.2
- Banned word used = -0.2 each
- First sentence doesn't answer the question = -0.3
- Generic writing with no sector/client specificity = -0.2
- Hedging language ("would look to", "aim to", "strive", "we can deliver", "we can plan", "we are able to") = -0.1 per instance
- Number cited that doesn't exactly match evidence record = -0.3

Maximum deduction: -3.0 (floor of 6.0)

---

## BANNED WORDS
leverage, synergy, holistic, bespoke, paradigm, seamless, cutting-edge, best-in-class, world-class, utilise, facilitate, foster, cultivate, strive, endeavour, passionate, meticulously, paramount, pivotal, committed to, dedicated to

---

## EVIDENCE VERIFICATION (CRITICAL)

For EVERY citation with a specific number or fact:
1. Find the evidence record by the ID cited
2. Check if the EXACT number appears in title, value, or source_text fields
3. Mark as VERIFIED or FABRICATED

A response with even one fabricated stat loses trust entirely in a real evaluation.

---

## OUTPUT FORMAT

## Overall Score: X.X/10
[One sentence: what makes it strong, what holds it back]

---

## Deductions
[If none: "None — full marks awarded"]
**-0.X** [specific reason]

---

## Sub-question Compliance
[Extract each requirement from the question, then check]
- ✓ [requirement met]
- ✗ [requirement missed or weak — be specific about what's missing]

---

## Evidence: X/Y citations verified
[List any fabricated or unverifiable citations]

---

## Actions:
🔴 MUST FIX: [Critical issues that will cost marks — or "None"]
🟠 SHOULD FIX: [Important improvements for competitive advantage — or "None"]
🟢 COULD FIX: [Polish items — or "None"]`;

// Generate response using Claude
async function fetchRefinementStyle(clientId: string): Promise<string | undefined> {
  try {
    const constraints = JSON.stringify([{ key: 'client', constraint_type: 'equals', value: clientId }]);
    const res = await fetch(
      `${BUBBLE_API_URL}/Refined_Draft?constraints=${encodeURIComponent(constraints)}&limit=10&sort_field=Created%20Date&descending=true`,
      { headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` } }
    );
    if (!res.ok) return undefined;
    const data = await res.json();
    const drafts = data.response?.results || [];
    if (drafts.length === 0) return undefined;

    // Aggregate style signals across all refinements
    const allSignals: string[] = [];
    const toneChanges: string[] = [];
    let evidenceInserted = 0, quantAdded = 0, complianceStrengthened = 0;

    for (const draft of drafts) {
      try {
        const p = JSON.parse(draft.patterns_extracted || '{}');
        if (p.style_signals) allSignals.push(...p.style_signals);
        if (p.tone_change && p.tone_change !== 'same') toneChanges.push(p.tone_change);
        if (p.evidence_inserted) evidenceInserted++;
        if (p.quantification_added) quantAdded++;
        if (p.compliance_strengthened) complianceStrengthened++;
      } catch { /* skip */ }
    }

    // Deduplicate signals
    const uniqueSignals = Array.from(new Set(allSignals)).slice(0, 8);
    if (uniqueSignals.length === 0) return undefined;

    const lines = [
      `This client has refined ${drafts.length} AI draft(s). Their edits reveal how they write winning bids:`,
      '',
      'STYLE SIGNALS (mirror these in your response):',
      ...uniqueSignals.map(s => `- ${s}`),
    ];
    if (toneChanges.length > 0) {
      const mostCommon = toneChanges.sort((a, b) =>
        toneChanges.filter(v => v === b).length - toneChanges.filter(v => v === a).length)[0];
      lines.push(`- Preferred tone: ${mostCommon}`);
    }
    const flags = [];
    if (evidenceInserted > drafts.length / 2) flags.push('always inserts specific evidence/case studies');
    if (quantAdded > drafts.length / 2) flags.push('always adds numbers and metrics');
    if (complianceStrengthened > drafts.length / 2) flags.push('always strengthens compliance language');
    if (flags.length > 0) lines.push(`- Consistent pattern: ${flags.join('; ')}`);

    return lines.join('\n');
  } catch { return undefined; }
}

async function generateResponse(questionText: string, evidence: string, targetSector?: string, buyerContext?: string, styleContext?: string): Promise<string> {
  const sectorContext = targetSector ? `\nTARGET SECTOR: ${targetSector}\nLead with evidence from ${targetSector} sector clients first.\n` : '';
  const buyerSection = buyerContext ? `\n\n=== BUYER INTELLIGENCE ===\n${buyerContext}\n=== END BUYER INTELLIGENCE ===\n` : '';
  const styleSection = styleContext ? `\n\n=== WRITING STYLE ===\n${styleContext}\n=== END WRITING STYLE ===\n` : '';
  
  // Detect explicit exceed signals
  const exceedPatterns = [
    'not limited to',
    'not be limited to', 
    'should also consider',
    'may wish to include',
    'may also include',
    'bidders are encouraged to',
    'tenderers are encouraged to',
    'should also demonstrate',
    'over and above',
    'in addition to the above',
    'but not exclusively',
    'including but not restricted to',
  ];
  const questionLower = questionText.toLowerCase();
  const hasExceedSignal = exceedPatterns.some(p => questionLower.includes(p));
  
  // Extract word limit from question text
  const wordLimitMatch = questionText.match(/(?:maximum|max|word limit|word count)[:\s]*(\d[\d,]*)\s*words/i) 
    || questionText.match(/(\d[\d,]*)\s*words?\s*(?:maximum|max|limit)/i);
  const wordLimit = wordLimitMatch ? parseInt(wordLimitMatch[1].replace(',', '')) : null;
  
  // Determine exceed strategy
  let exceedInstruction = '';
  
  if (hasExceedSignal) {
    // Explicit signal — always exceed
    exceedInstruction = `

=== EXCEED OPPORTUNITY — EXPLICIT SIGNAL ===
This question contains language like "not limited to" — the evaluator is deliberately inviting you to go beyond the stated requirements. This is a scoring opportunity.

STRATEGY:
1. Address every explicit bullet point/requirement first
2. THEN add 2-3 additional relevant points from the evidence library that demonstrate deeper capability or added value
3. Use confident transitions: "Additionally...", "Our experience also demonstrates...", "Beyond the stated requirements..."
${wordLimit ? `4. Word limit is ${wordLimit} — use up to 95% of it. You have room to exceed.` : ''}

This is the difference between a compliant answer (6-7) and a winning answer (8-9).
=== END EXCEED ===
`;
  } else if (wordLimit && wordLimit >= 750) {
    // No explicit signal, but enough word headroom to add value
    exceedInstruction = `

=== EXCEED OPPORTUNITY — WORD LIMIT HEADROOM ===
Word limit: ${wordLimit} words. After covering all explicit requirements, use any remaining headroom (aim for 90-95% of limit) to add additional value:

STRATEGY:
1. Cover every stated requirement thoroughly first — this is your priority
2. If you reach all requirements and you're below 75% of the word limit, add value by:
   - Citing an additional relevant case study or outcome from the evidence library
   - Adding a brief section on continuous improvement, added value, or innovation relevant to the question
   - Demonstrating broader experience that strengthens the response
3. Do NOT pad with filler or repeat yourself — every additional sentence must add scoring value
4. If requirements naturally fill 90%+ of the limit, don't force additional content

The evaluator has given you ${wordLimit} words for a reason. Using only 60% signals shallow thinking. Using 90-95% signals thorough capability.
=== END EXCEED ===
`;
  }
  // If wordLimit < 750 or no wordLimit and no signal: no exceed instruction — just answer the question well

  console.log('Exceed detection:', hasExceedSignal ? 'EXPLICIT SIGNAL' : wordLimit && wordLimit >= 750 ? `HEADROOM (${wordLimit} words)` : 'NONE');

  const prompt = `${BIDWRITE_PROMPT}\n\n---${sectorContext}${styleSection}${buyerSection}${exceedInstruction}\nQUESTION:\n${questionText}\n\nEVIDENCE LIBRARY (use only this evidence):\n${evidence}\n\nWrite the response:`;
  
  const message = await callClaude(
    [{ role: 'user', content: prompt }],
    { 
      maxTokens: 4000,
      estimatedInputTokens: estimateTokens(prompt),
      temperature: 0.4  // Grounded writing — evidence accuracy over creativity
    }
  );
  
  const content = message.content[0];
  if (content.type === 'text') {
    return content.text;
  }
  return '';
}

// Score with full BidScore evaluation using Claude - includes evidence for verification
async function scoreResponse(questionText: string, answerText: string, evidence: string): Promise<{ score: number; evaluation: string; mustFix: string; shouldFix: string }> {
  const prompt = `${BIDSCORE_PROMPT}

---

EVIDENCE LIBRARY (use this to VERIFY citations):
${evidence}

---

QUESTION:
${questionText}

---

RESPONSE TO EVALUATE:
${answerText}

---

Evaluate now. Check EVERY citation against the evidence library above.`;
  
  // Use Sonnet for scoring - better hallucination detection and nuanced evaluation
  const message = await callClaude(
    [{ role: 'user', content: prompt }],
    {
      maxTokens: 3000,
      estimatedInputTokens: estimateTokens(prompt),
      temperature: 0.3  // Low temp for consistent, deterministic scoring
    }
  );
  
  let evaluation = '';
  const content = message.content[0];
  if (content.type === 'text') {
    evaluation = content.text;
  }
  
  // Extract score
  const scoreMatch = evaluation.match(/Overall Score:\s*(\d+\.?\d*)/i) || evaluation.match(/Score:\s*(\d+\.?\d*)/i);
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : 5;
  
  // Extract gap analysis - handle multi-line content
  let mustFix = '';
  let shouldFix = '';
  
  // Look for MUST FIX section - capture until SHOULD FIX or COULD FIX or next section
  const mustFixMatch = evaluation.match(/🔴\s*MUST FIX[:\s]*([\s\S]*?)(?=🟠|🟢|##|$)/i) 
    || evaluation.match(/MUST FIX[:\s]*([\s\S]*?)(?=SHOULD FIX|COULD FIX|##|$)/i);
  if (mustFixMatch) {
    mustFix = mustFixMatch[1].trim().replace(/\n+/g, ' ').substring(0, 500);
  }
  
  // Look for SHOULD FIX section - capture until COULD FIX or next section
  const shouldFixMatch = evaluation.match(/🟠\s*SHOULD FIX[:\s]*([\s\S]*?)(?=🟢|##|$)/i)
    || evaluation.match(/SHOULD FIX[:\s]*([\s\S]*?)(?=COULD FIX|##|$)/i);
  if (shouldFixMatch) {
    shouldFix = shouldFixMatch[1].trim().replace(/\n+/g, ' ').substring(0, 500);
  }
  
  // Also check for CRITICAL GAPS or PRIORITY ACTIONS format
  if (!mustFix) {
    const criticalMatch = evaluation.match(/CRITICAL GAPS?[:\s]*([\s\S]*?)(?=PRIORITY|##|$)/i);
    if (criticalMatch && !criticalMatch[1].toLowerCase().includes('none')) {
      mustFix = criticalMatch[1].trim().replace(/\n+/g, ' ').substring(0, 500);
    }
  }
  
  if (!shouldFix) {
    const priorityMatch = evaluation.match(/PRIORITY ACTIONS?[:\s]*([\s\S]*?)(?=##|CONFIDENTIAL|$)/i);
    if (priorityMatch) {
      shouldFix = priorityMatch[1].trim().replace(/\n+/g, ' ').substring(0, 500);
    }
  }
  
  console.log('Extracted gaps - mustFix:', mustFix?.substring(0, 100), 'shouldFix:', shouldFix?.substring(0, 100));
  
  return { score, evaluation, mustFix, shouldFix };
}

// Improve response based on evaluation feedback using Claude
async function improveResponse(questionText: string, currentAnswer: string, evaluation: string, evidence: string, wordLimit?: number | null): Promise<string> {
  const wordCountRule = wordLimit
    ? `- Maintain ${wordLimit} word limit — aim for ${Math.round(wordLimit * 0.9)}-${Math.round(wordLimit * 0.95)} words. Do NOT shrink the response below 85% of the limit.`
    : `- Maintain 600-680 words unless the original was longer, in which case keep a similar length. Do NOT shrink below 580 words.`;

  const improvePrompt = `You are BidWrite. Improve the response below based on the evaluation feedback. This is a UK public sector bid — quality matters enormously.

=== PRIORITY 1: FIX HALLUCINATED NUMBERS AND PLACEHOLDERS (CRITICAL) ===
For EACH citation in the current response:
1. Find that evidence record in the library below
2. Check: is the EXACT number in the evidence? (title, value, or source_text fields)
3. If NO → REMOVE that number or replace with the actual value

HOW TO FIX:
- REMOVE the hallucinated number entirely
- OR replace with what the evidence ACTUALLY says
- OR convert to capability language: "strong safety performance" (no number)

ALSO: If the response contains ANY text matching [EVIDENCE GAP...], [INSERT...], [TBC], [PLACEHOLDER] or similar:
- Delete it entirely
- Replace with confident capability language (no number, no bracket, no gap marker)
- A visible placeholder in a bid submission is worse than no number at all

=== PRIORITY 2: ADDRESS MISSED SUB-QUESTIONS ===
Read the MUST FIX and SHOULD FIX sections from the evaluation carefully.
If a sub-question was missed or underdeveloped:
- Add a new section/header for it
- Use capability language if no evidence — do NOT stay silent
- Keep it proportionate (don't make it longer than other sections)

=== PRIORITY 3: STRENGTHEN CLIENT UNDERSTANDING ===
The difference between good and outstanding is showing you understand THEIR specific context.
- If the question mentions a specific concern (disruption, compliance risk, TUPE) — mirror that language back
- Add one sentence per section showing WHY your approach matters for this specific sector/environment
- Make it feel like you wrote this FOR them, not as a generic template

=== PRIORITY 4: SHARPEN THE WRITING ===
- First sentence: does it directly answer the question? If not, rewrite it
- Remove any banned words (seamless, leverage, holistic, etc.)
- Name client before every citation
- Replace hedging language: "would look to" → "will", "aim to" → "deliver"

RULES:
${wordCountRule}
- EVERY cited number MUST exist VERBATIM in evidence — if not, remove it
- TARGET 8-12 citations total. Scan the evaluation feedback — if the scorer mentions "evidence available: [ID]" or "could have cited [ID]" or similar, ADD those citations now. Do not leave evidenced points uncited.
- Output the improved response only. No explanation, no preamble.`;


  const prompt = `${improvePrompt}

---

QUESTION:
${questionText}

CURRENT RESPONSE:
${currentAnswer}

EVALUATION FEEDBACK:
${evaluation}

EVIDENCE LIBRARY (verify EVERY number exists here before citing):
${evidence}

Write the improved response:`;

  const message = await callClaude(
    [{ role: 'user', content: prompt }],
    { 
      maxTokens: 4000,
      estimatedInputTokens: estimateTokens(prompt)
    }
  );
  
  const content = message.content[0];
  if (content.type === 'text') {
    // Strip any leaked placeholder markers before returning
    return content.text.replace(/\[EVIDENCE GAP[^\]]*\]/gi, '').replace(/\[INSERT[^\]]*\]/gi, '').replace(/\[TBC[^\]]*\]/gi, '').replace(/\[PLACEHOLDER[^\]]*\]/gi, '').trim();
  }
  return currentAnswer;
}

export async function POST(request: NextRequest) {
  try {
    const { question_id, client_id } = await request.json();
    
    if (!question_id || !client_id) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }
    
    // Enable improvement loops for quality
    const skipImprovement = false;
    
    console.log('Processing question:', question_id);
    console.log('skipImprovement:', skipImprovement);
    console.log('Semantic search enabled:', USE_SEMANTIC_SEARCH);
    
    // First get the question text and tender ID
    const qResponse = await fetch(`${BUBBLE_API_URL}/tender_questions/${question_id}`, {
      headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` },
    });
    
    if (!qResponse.ok) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }
    
    const questionData = await qResponse.json();
    const questionText = questionData.response?.question_text;
    let tenderId = questionData.response?.tender;
    
    console.log('Question data tender field:', tenderId);
    console.log('Question data full response:', JSON.stringify(questionData.response).substring(0, 500));
    
    // Handle if tender is returned as object vs string ID
    if (tenderId && typeof tenderId === 'object') {
      tenderId = tenderId._id || tenderId.id;
    }
    
    // Get tender sector and buyer name for evidence matching and buyer intelligence
    let tenderSector: string | undefined;
    let buyerName: string | undefined;
    if (tenderId) {
      try {
        console.log('Fetching tender:', tenderId);
        const tenderResponse = await fetch(`${BUBBLE_API_URL}/Tenders%20Data%20Type/${tenderId}`, {
          headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` },
        });
        if (tenderResponse.ok) {
          const tenderData = await tenderResponse.json();
          console.log('Tender data:', JSON.stringify(tenderData.response).substring(0, 500));
          tenderSector = tenderData.response?.sector;
          buyerName = tenderData.response?.buyer_name || tenderData.response?.buyer || tenderData.response?.contracting_authority;
          console.log('Tender sector:', tenderSector || 'Not set');
          console.log('Buyer name:', buyerName || 'Not set');
        } else {
          console.log('Tender fetch failed:', tenderResponse.status);
        }
      } catch (e) {
        console.log('Could not fetch tender sector:', e);
      }
    } else {
      console.log('No tender ID found on question');
    }

    // Fetch buyer intelligence + refinement style in parallel
    let buyerContext: string | undefined;
    let styleContext: string | undefined;
    const parallelFetches: Promise<void>[] = [];

    if (buyerName && client_id) {
      parallelFetches.push((async () => {
        try {
          const [profile, insights] = await Promise.all([
            fetchBuyerProfile(client_id, buyerName),
            fetchOutcomeInsights(client_id, buyerName),
          ]);
          if (profile && profile.total_bids > 0) {
            const lossWarnings = insights
              .filter((i: any) => i.insight_type === 'negative')
              .slice(0, 3)
              .map((i: any) => i.description || i.insight_text || '')
              .filter(Boolean);
            buyerContext = formatBuyerContextForPrompt(profile, lossWarnings);
            console.log('Buyer context injected for:', buyerName);
          }
        } catch (e) {
          console.log('Could not fetch buyer context:', e);
        }
      })());
    }

    if (client_id) {
      parallelFetches.push((async () => {
        try {
          styleContext = await fetchRefinementStyle(client_id);
          if (styleContext) console.log('Refinement style injected from', styleContext.match(/refined (\d+)/)?.[1], 'drafts');
        } catch (e) {
          console.log('Could not fetch refinement style:', e);
        }
      })());
    }

    await Promise.all(parallelFetches);
    
    // Fetch evidence - use semantic search if enabled
    let evidence: string;
    if (USE_SEMANTIC_SEARCH) {
      console.log('Using SEMANTIC SEARCH for evidence selection...');
      console.log('Target sector:', tenderSector || 'Auto-detect from question');
      evidence = await fetchRelevantEvidence(client_id, questionText, tenderSector);
    } else {
      console.log('Using FULL EVIDENCE DUMP (semantic search disabled)...');
      evidence = await fetchEvidence(client_id);
    }
    
    console.log('Generating answer with', evidence.length, 'chars of evidence...');
    
    // Extract word limit from question text (for improve loop)
    const wordLimitMatch = questionText.match(/(?:maximum|max|word limit|word count)[:\s]*(\d[\d,]*)\s*words/i)
      || questionText.match(/(\d[\d,]*)\s*words?\s*(?:maximum|max|limit)/i);
    const questionWordLimit = wordLimitMatch ? parseInt(wordLimitMatch[1].replace(',', '')) : null;
    console.log('Question word limit:', questionWordLimit || 'None detected');

    // Generate initial answer
    let answer = await generateResponse(questionText, evidence, tenderSector, buyerContext, styleContext);
    console.log('Initial answer length:', answer.length);

    // Score it (pass evidence for hallucination checking)
    console.log('Scoring...');
    let { score, evaluation, mustFix, shouldFix } = await scoreResponse(questionText, answer, evidence);
    console.log('Initial score:', score);
    console.log('Gaps - Must fix:', mustFix, 'Should fix:', shouldFix);

    // THE LOOP - Improve until score >= 8.5 or max 2 iterations
    let loopCount = 0;
    const maxLoops = skipImprovement ? 0 : 2;
    const targetScore = 8.5;

    console.log('Loop setup: maxLoops=', maxLoops, 'targetScore=', targetScore, 'currentScore=', score);

    while (score < targetScore && loopCount < maxLoops) {
      loopCount++;
      console.log(`Loop ${loopCount}: Score ${score} < ${targetScore}, improving...`);

      // Improve based on feedback — pass word limit so improve step doesn't shrink the response
      answer = await improveResponse(questionText, answer, evaluation, evidence, questionWordLimit);
      console.log(`Loop ${loopCount}: Improved answer length:`, answer.length);
      
      // Re-score (pass evidence for hallucination checking)
      const newResult = await scoreResponse(questionText, answer, evidence);
      score = newResult.score;
      evaluation = newResult.evaluation;
      mustFix = newResult.mustFix;
      shouldFix = newResult.shouldFix;
      console.log(`Loop ${loopCount}: New score:`, score);
    }
    
    console.log('Final score:', score, 'after', loopCount, 'improvement loops', skipImprovement ? '(fast mode)' : '');
    
    // Save to Bubble
    const saveResponse = await fetch(`${BUBBLE_API_URL}/tender_questions/${question_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        answer_text: answer,
        final_evaluation: evaluation,
        score: score,
        status: 'draft',
        must_fix: mustFix || '',
        should_fix: shouldFix || '',
      }),
    });
    
    if (!saveResponse.ok) {
      const errorText = await saveResponse.text();
      console.error('Failed to save to Bubble:', saveResponse.status, errorText);
      return NextResponse.json({ 
        error: 'Failed to save', 
        details: errorText,
        answer_generated: true,
        answer_length: answer.length,
        score: score
      }, { status: 500 });
    }
    
    // Check if governance detection is working - use full question content
    const queryLower = questionText.toLowerCase();
    const isGovernanceQuery = queryLower.includes('governance') || 
                             queryLower.includes('monitoring') || 
                             queryLower.includes('oversight') || 
                             queryLower.includes('review') || 
                             queryLower.includes('meeting') || 
                             queryLower.includes('escalation') || 
                             queryLower.includes('kpi') || 
                             queryLower.includes('reporting') || 
                             queryLower.includes('dashboard') || 
                             queryLower.includes('audit') || 
                             queryLower.includes('steering') || 
                             queryLower.includes('committee') || 
                             queryLower.includes('framework') || 
                             queryLower.includes('structure') ||
                             queryLower.includes('management approach') ||
                             queryLower.includes('service model') ||
                             queryLower.includes('performance monitoring') ||
                             queryLower.includes('continuous improvement') ||
                             queryLower.includes('how you manage') ||
                             queryLower.includes('how do you manage') ||
                             queryLower.includes('describe your approach') ||
                             queryLower.includes('explain your approach') ||
                             queryLower.includes('outline your approach') ||
                             queryLower.includes('detail your approach') ||
                             queryLower.includes('set out your approach') ||
                             queryLower.includes('management system') ||
                             queryLower.includes('performance management') ||
                             queryLower.includes('service delivery') ||
                             queryLower.includes('client management') ||
                             queryLower.includes('contract management') ||
                             queryLower.includes('stakeholder management') ||
                             queryLower.includes('communication') ||
                             queryLower.includes('accountability') ||
                             queryLower.includes('transparency');

    console.log('Saved to Bubble successfully');
    console.log('GOVERNANCE DETECTION:', isGovernanceQuery ? 'DETECTED' : 'NOT DETECTED', 'for question:', questionText.substring(0, 50));
    
    return NextResponse.json({ 
      success: true, 
      question_id,
      score,
      loop_count: loopCount,
      answer_length: answer.length,
      governance_detected: isGovernanceQuery // Add this to see in response
    });
    
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
