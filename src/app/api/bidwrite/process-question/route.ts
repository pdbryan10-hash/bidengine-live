export const maxDuration = 180;

import { NextRequest, NextResponse } from 'next/server';
import { callClaude, rateLimitDelay, logRateLimitStatus, estimateTokens } from '@/lib/claude';
import { 
  generateEmbedding, 
  cosineSimilarity, 
  hybridSearch, 
  formatSearchResultsForPrompt,
  EvidenceWithEmbedding,
  SemanticSearchResult
} from '@/lib/semantic';

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

const BIDWRITE_PROMPT = `You are BidWrite, a senior bid writer with 20 years experience winning UK public sector FM and services contracts.
Write like you've done this work yourself. Confident. Specific. Direct. Human. Authoritative — not salesy.

=== WINNING MINDSET ===

Before writing, privately identify:
1. What is the evaluator's PRIMARY concern for this question? (cost control? compliance risk? TUPE disruption? service continuity?)
2. What ONE piece of evidence from the library best addresses that concern?
3. What specific context about THIS sector makes our approach particularly relevant?

Lead with the answer to their primary concern. Don't bury the lead.

DIFFERENTIATION — what separates an 8 from a 10:
- An 8 proves competence: "We have done this and here's the evidence"
- A 10 shows CLIENT UNDERSTANDING: "We know why this matters to you specifically, and here's how we address your exact situation"
- Reference back to what they stated in the question. If they say "minimising disruption to clinical operations", use that phrase and explain how your approach directly addresses it.

=== WRITING VOICE ===

Write with authority. You are not trying to impress — you are informing a decision.
- Short sentences when making a point
- Longer when explaining methodology
- Never apologetic, never hedging on capability
- "Our approach is X" not "We would look to implement X"
- "We deliver X" not "We aim/strive/endeavour to deliver X"

=== ABSOLUTE RULES ===

1. NEVER write "BidEngine" - always "we" or "our"
2. ALWAYS name the client in EVERY citation sentence: "At [Client Name], we achieved..."
3. ONLY cite evidence where the SERVICE TYPE matches the question. FM evidence for FM questions. Catering evidence for catering questions. IT evidence for IT questions. If you only have FM evidence but the question is about catering, DO NOT cite FM evidence - declare the gap instead. A satisfaction score from an FM contract is NOT evidence of catering performance.
4. NEVER use these banned words: leverage, synergy, holistic, bespoke, paradigm, seamless, cutting-edge, best-in-class, world-class
5. DECLARE EVIDENCE GAPS - if asked for a specific metric (%, rate, number) and you don't have MATCHING evidence, SAY SO explicitly. Having evidence from a different service type is the same as having no evidence.

=== EVIDENCE GAP DECLARATION ===
If the question asks for a specific metric and you DON'T have matching evidence:
- DO NOT stay silent and hope they won't notice
- DO NOT sound confident without proof
- DO say something like: "We do not currently hold [specific metric] at contract level; we measure and report this monthly during delivery..."
- DO pivot to capability/methodology if you can't prove outcomes

Examples:
- No first-time-fix rate? → "First-time fix rate is tracked and reported monthly; our diagnostic-first approach and van stock management consistently delivers high FTF performance."
- No BMS optimisation evidence? → "We do not currently hold contract-specific BMS optimisation outcomes; however, our methodology includes..."
- No carbon reduction data? → "Verified carbon data is available on request; our standard approach delivers..."

Silent gaps look like hiding. Declared gaps look like honesty. Evaluators reward honesty.

=== INTERNAL: IDENTIFY THE CLIENT SECTOR (DO NOT INCLUDE IN RESPONSE) ===

Silently identify the sector from the question (office, hospital, university, prison, data centre, etc.)
Then use appropriate language for that sector throughout your response.

IMPORTANT: Do NOT write "CLIENT SECTOR IDENTIFIED:" or any sector identification text in your response.
Do NOT write "I'll identify the client sector first" or similar meta-commentary.
Just write the response using the appropriate sector language.

=== SUB-QUESTION DECOMPOSITION ===

Before writing, silently identify ALL sub-questions or requirements in the question. Complex questions often have 3-5 distinct requirements buried in one question.

Example: "Describe your approach to mobilisation, including TUPE, asset validation, and achieving compliance from Day 1"
Sub-questions: (1) Mobilisation approach, (2) TUPE process, (3) Asset validation method, (4) Day-1 compliance

Address EACH sub-question explicitly. Missing one = evaluator marks you down on that criterion.
Use a header per sub-topic if the question has 3+ distinct requirements.

=== WORD COUNT ===
If a word limit is specified in the question, aim for 90-95% of that limit.
If NO word limit is specified, write 600-680 words. This is the sweet spot — enough depth to demonstrate expertise and evidence, without padding that dilutes impact.

=== WRITING STYLE (CRITICAL) ===

Write NATURALLY first, then add citations. Don't let citations break your flow.

BAD (robotic, citation-led):
"We mobilise contracts through a 6-8 week programme [Client A | ID] with asset validation [Client A | ID]."

GOOD (natural, confident):
"We mobilise contracts through a structured 6-8 week programme covering TUPE integration, asset validation, and parallel running. At [Client], we validated 4,620 assets and achieved 100% critical PPM scheduling from Day 1 [Client | ID]."

=== RICH CONTENT - NOT EVIDENCE CATALOGUES ===

Don't just list evidence. Add CONTEXT, EXPERTISE, and CLIENT UNDERSTANDING between citations.

BAD (evidence catalogue):
"Our HVAC compliance programme covers filter changes and belt inspections. We maintain logs and conduct commissioning. At [Client], we achieved 100% compliance [ID]."

GOOD (rich, expert writing):
"HVAC systems require particular attention where air quality impacts occupant wellbeing. Our compliance programme covers planned filter changes, belt inspections, system balancing, and efficiency monitoring - with maintenance windows carefully scheduled around operations to minimise disruption. At [Client], this approach delivered 100% statutory compliance [Client | ID]."

THE DIFFERENCE:
- Context first (why this matters for THIS client type)
- Reference relevant standards
- Show operational awareness
- THEN prove with evidence from the library

=== SECTOR-APPROPRIATE LANGUAGE ===

Match your language to the sector identified in the question:
- Healthcare: patient outcomes, infection control, clinical operations, HTM compliance
- Education: term-time constraints, safeguarding, teaching schedules
- Justice: security protocols, enhanced vetting, HMPPS requirements
- Commercial/Office: business continuity, tenant/occupant liaison, minimal disruption
- Data centres: uptime criticality, concurrent maintainability, N+1 redundancy
- Retail: trading hours, customer experience
- Manufacturing: production continuity, shift patterns

=== EVIDENCE SELECTION ===

From the evidence library provided, select case studies that:
1. Best match the TARGET sector (if available)
2. Demonstrate relevant outcomes for the question being asked
3. Have verifiable facts you can cite accurately

IMPORTANT: When a target sector is specified, ALWAYS lead with sector-matched evidence first.
Your first citation should be from a client in the same sector as the tender before using evidence from other sectors.
If the library contains mixed sectors, prioritise evidence from similar environments.
If no exact sector match exists, use the strongest evidence available AND explicitly bridge the gap in the writing. Add a sentence like: "While our direct experience in [sector] includes [X], our approach in [comparable sector] — where [similar challenge] applies — directly translates to this environment." This shows sector awareness rather than looking like you didn't notice the gap.

GOVERNANCE & MONITORING PRIORITY: If the question asks about governance, monitoring, oversight, reporting, KPIs, meetings, reviews, escalation, or audit processes, prioritise evidence that shows explicit governance structures, meeting cadences, escalation matrices, KPI frameworks, and monitoring protocols. Cite specific governance evidence rather than just stating processes.

=== STANDARDS TO REFERENCE (where relevant to the sector) ===
- Electrical: BS 7671, IET Code of Practice
- Fire: BS 5839, RRO 2005
- Water: L8 ACoP, HSG274
- Gas: Gas Safe, IGEM
- HVAC: CIBSE guides (general), HTM 03-01 (healthcare only)
- General: ISO 45001, ISO 9001, ISO 14001

=== CITATION PATTERN ===
1. Make your point with expertise (2-3 sentences showing you understand the work)
2. Then prove it: "At [Client], we [achieved/delivered/maintained] [specific outcome] [Citation]"
3. Move to next point

CRITICAL — EXACT STAT REPRODUCTION: When citing a number from evidence, reproduce it EXACTLY as it appears in the evidence field. Never rephrase, round, or restate. If the evidence says "47 staff", write "47 staff" — not "47 of 47 staff", not "approximately 47 staff". Copy the number verbatim.

TARGET 8-12 citations per response. Use the full evidence library — if relevant evidence exists, cite it. Do not hold back on citations to keep the writing "clean" — evaluators want proof.
Not every paragraph needs a citation. Some can be pure expertise showing you know the work. But aim to cite evidence at least once every 60-70 words.

=== FIRST SENTENCE ===
Answer the question directly. What do you DO and HOW?
Your opening sentence must be a concrete statement of capability — no preamble, no "we understand that...".
Template: "We [verb] [topic] through [method 1], [method 2] and [method 3]."
Example: "We deliver statutory compliance through a structured PPM programme, dedicated compliance management, and real-time monitoring across all contract assets."

=== STRUCTURE ===
Each section MUST use a bold header on its OWN LINE — never embedded mid-sentence or mid-paragraph.

WRONG: "TUPE Transfer Management: Our approach involves..."
RIGHT:
**TUPE Transfer Management**
Our approach involves...

Use this pattern throughout:
**[Topic Header]**
[Context - why this matters] [Your approach with standards/methods] [Operational awareness] [Then: "At [Client], we achieved..." with citation]

**[Next Topic]**
[Same pattern - context, approach, evidence]

**Governance and Monitoring**
[Specific meeting rhythms, KPIs, escalation routes, reporting cadence]

Evaluators skim headers before reading body text — clear structure signals quality before a single word is read.

Evidence table:
ID: [full_id] | Client | Key Fact

=== EVIDENCE TABLE FORMAT (CRITICAL) ===
Each evidence row MUST be on its own separate line. Use a newline character after each row.

Format:
ID: [id] | Client Name | Key Fact
ID: [id] | Client Name | Key Fact
ID: [id] | Client Name | Key Fact

CORRECT OUTPUT EXAMPLE:
ID: 1770046912286x360146528073002100 | NHS Acute Trust | Zero grievances
ID: 1770046159763x498119403661222850 | Midshire County Council | 98-100% PPM
ID: 1770046684303x398503418975743040 | Newcastle City Council | 99.2% PPM

WRONG (all on one line):
ID: 123x... | Client A | Fact 1 ID: 456x... | Client B | Fact 2 ID: 789x... | Client C | Fact 3

RULES:
1. ONE ROW PER LINE - press Enter/newline after each evidence row
2. NO markdown tables, NO |---| separators, NO header row
3. Key Fact = ONLY what you cited in the response

=== ANSWERING THE QUESTION ===
If they ask about HVAC, electrical, water, gas, fire - address EACH ONE with context and expertise.
If they ask about TUPE - explain the actual process, the human element, the communication approach.
Show you understand the CLIENT'S world, not just your processes.

=== EVIDENCE INTEGRITY (CRITICAL - THIS IS WHERE YOU LOSE POINTS) ===

You can ONLY cite facts that EXACTLY appear in the evidence provided.

BEFORE WRITING ANY CITATION, DO THIS CHECK:
1. Find the evidence record by client name
2. Read the EXACT fields: title, value, source_text
3. ONLY use numbers/facts that appear VERBATIM in those fields
4. If a number is NOT in the evidence record, DO NOT WRITE IT

COMMON HALLUCINATION MISTAKES (these will cost you 0.5+ points each):
✗ Citing a number not in the evidence record → HALLUCINATED
✗ Rounding numbers (99.1% → 99%) → WRONG NUMBER
✗ Adding scope/geography qualifiers not in evidence → HALLUCINATED. EXAMPLE: evidence says "47 staff transferred" — you write "47 staff across 6 hospital sites" — WRONG. The site count is not in the evidence. Write ONLY what the evidence states, verbatim. Building counts, site counts, geographic scope, and organisational scale CANNOT be inferred or added.
✗ Claiming "zero RIDDOR" when evidence shows any other number → CRITICAL ERROR
✗ Pairing a real stat with a made-up companion: "980 observations and 296 toolbox talks" — if only 980 is evidenced, write ONLY "980 observations", not both → HALLUCINATED COMPANION STAT

RIDDOR CLAIMS - EXTREME CAUTION:
- ONLY claim "zero RIDDOR" if the evidence EXPLICITLY states "0" or "zero"
- If evidence shows ANY number other than zero, use that EXACT number
- If evidence doesn't mention RIDDOR at all, DO NOT claim any RIDDOR performance

WHAT YOU CAN CITE:
- The exact "value" field as stated
- The exact "title" field as stated
- Numbers from "source_text" only if they appear word-for-word

WHAT YOU CANNOT DO:
- Infer numbers that aren't stated
- Round numbers
- Add context not in evidence
- Combine facts from different records into one citation
- Write two numbers in the same sentence unless BOTH appear verbatim in the evidence — if only one is evidenced, cite only that one

SAFE PATTERN:
1. Read evidence record
2. Note EXACTLY what it says
3. Write using ONLY those exact facts
4. DO NOT ADD anything not in the record

IF YOU'RE NOT 100% SURE A FACT IS IN THE EVIDENCE → DON'T CITE IT
Use capability language instead (no number, no citation needed)

=== END EVIDENCE INTEGRITY ===

=== UNCITED CLAIMS RULE ===

If you have no evidence for a specific number: REMOVE THE NUMBER. Write capability language instead.

EXAMPLES:
- No evidence for "12-week programme" → write "structured mobilisation programme" (no number)
- No evidence for "98% completion" → write "strong PPM completion performance" (no number)
- "early engagement", "systematic approach", "weekly reviews" → write confidently, no citation needed

NEVER write [EVIDENCE GAP], [INSERT], [TBC] or any placeholder. If the number isn't evidenced, it doesn't exist.

=== END UNCITED CLAIMS RULE ===

CAPABILITY vs DELIVERY:
- CAPABILITY = what we CAN do (no citation needed, no specific numbers)
  Example: "We conduct weekly compliance reviews and monthly audits"
- DELIVERY = what we HAVE DONE (citation REQUIRED, number must be in evidence)
  Example: "At [Client], we achieved 99.0% PPM completion [Client | ID]"

WHEN EVIDENCE IS MISSING FOR A SPECIFIC NUMBER:
- State capability WITHOUT numbers: "We maintain strong compliance performance"
- NEVER write placeholders like [EVIDENCE GAP] or [INSERT] in the response
- NEVER leave a blank or bracketed gap — omit the number entirely and write confidently without it
- Focus on what you CAN evidence from the library

=== BANNED WORDS - AUTOMATIC FAIL IF USED ===

NEVER use these words (they will cost you 0.5 points EACH):
leverage, synergy, holistic, bespoke, paradigm, utilise, facilitate, foster, cultivate, cutting-edge, best-in-class, world-class, industry-leading, adept, strive, endeavour, passion, passionate, meticulously, paramount, pivotal, streamlined, designed to ensure, committed to, dedicated to

ESPECIALLY NEVER USE "SEAMLESS" - use these instead:
- "seamless transition" → "uninterrupted transition" or "smooth transition"
- "seamless service" → "continuous service" or "consistent service"
- "seamless integration" → "effective integration" or "complete integration"

Before submitting, CTRL+F for "seamless" and replace it. This word alone costs 0.5 points.

=== FINAL CHECK (DO ALL OF THESE) ===
1. Does first sentence actually answer the question?
2. Is language appropriate to the TARGET sector in the question?
3. For EVERY citation, verify the number appears VERBATIM in that evidence record
4. Did I address each sub-question specifically?
5. Any specific number without a citation? → Add flag or remove
6. Did I use "seamless" anywhere? → REPLACE IT NOW`;

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
- Hedging language ("would look to", "aim to", "strive") = -0.1 per instance
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
async function generateResponse(questionText: string, evidence: string, targetSector?: string): Promise<string> {
  const sectorContext = targetSector ? `\nTARGET SECTOR: ${targetSector}\nLead with evidence from ${targetSector} sector clients first.\n` : '';
  
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

  const prompt = `${BIDWRITE_PROMPT}\n\n---${sectorContext}${exceedInstruction}\nQUESTION:\n${questionText}\n\nEVIDENCE LIBRARY (use only this evidence):\n${evidence}\n\nWrite the response:`;
  
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

    // Extract word limit from question text (for use in improve loop)
    const wordLimitMatch = questionText?.match(/(?:maximum|max|word limit|word count)[:\s]*(\d[\d,]*)\s*words/i)
      || questionText?.match(/(\d[\d,]*)\s*words?\s*(?:maximum|max|limit)/i);
    const wordLimit = wordLimitMatch ? parseInt(wordLimitMatch[1].replace(',', '')) : null;

    let tenderId = questionData.response?.tender;
    
    console.log('Question data tender field:', tenderId);
    console.log('Question data full response:', JSON.stringify(questionData.response).substring(0, 500));
    
    // Handle if tender is returned as object vs string ID
    if (tenderId && typeof tenderId === 'object') {
      tenderId = tenderId._id || tenderId.id;
    }
    
    // Get tender sector for evidence matching
    let tenderSector: string | undefined;
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
          console.log('Tender sector for evidence matching:', tenderSector || 'Not set');
        } else {
          console.log('Tender fetch failed:', tenderResponse.status);
        }
      } catch (e) {
        console.log('Could not fetch tender sector:', e);
      }
    } else {
      console.log('No tender ID found on question');
    }
    
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
    
    // Generate initial answer
    let answer = await generateResponse(questionText, evidence, tenderSector);
    console.log('Initial answer length:', answer.length);
    
    // Score it (pass evidence for hallucination checking)
    console.log('Scoring...');
    let { score, evaluation, mustFix, shouldFix } = await scoreResponse(questionText, answer, evidence);
    console.log('Initial score:', score);
    console.log('Gaps - Must fix:', mustFix, 'Should fix:', shouldFix);
    
    // THE LOOP - Improve until score >= 8.5 or max 1 iteration
    // Skip if fast_mode is enabled
    let loopCount = 0;
    const maxLoops = skipImprovement ? 0 : 2;  // 2 improvement passes max
    const targetScore = 8.5;
    
    console.log('Loop setup: maxLoops=', maxLoops, 'targetScore=', targetScore, 'currentScore=', score);
    console.log('Will loop?', score < targetScore && loopCount < maxLoops);
    
    while (score < targetScore && loopCount < maxLoops) {
      loopCount++;
      console.log(`Loop ${loopCount}: Score ${score} < ${targetScore}, improving...`);
      
      // Improve based on feedback
      answer = await improveResponse(questionText, answer, evaluation, evidence, wordLimit);
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
