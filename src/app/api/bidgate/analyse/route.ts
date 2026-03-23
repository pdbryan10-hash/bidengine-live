export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import Anthropic from '@anthropic-ai/sdk';

const BUBBLE_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientId = formData.get('clientId') as string;
    const tenderName = formData.get('tenderName') as string;
    const buyerName = formData.get('buyerName') as string | null;
    const buyerOrgType = formData.get('buyerOrgType') as string | null;

    if (!file || !clientId) {
      return NextResponse.json({ error: 'Missing file or clientId' }, { status: 400 });
    }

    // 20MB limit — larger files will cause token overflow or timeout
    const MAX_FILE_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 20 MB. Try splitting the document or removing appendices.` }, { status: 413 });
    }

    // ── 1. Extract text ──────────────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();
    let tenderText = '';
    if (fileName.endsWith('.pdf')) {
      tenderText = (await pdfParse(buffer)).text;
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      tenderText = (await mammoth.extractRawText({ buffer })).value;
    } else {
      tenderText = buffer.toString('utf-8');
    }

    // ── 2. Fetch BidVault evidence from Bubble ───────────────────────────────
    const bh = { 'Authorization': `Bearer ${process.env.BUBBLE_API_KEY || ''}` };
    let evidenceSummary = 'No evidence library data available.';
    let evidenceCounts: Record<string, number> = {};
    let totalEvidence = 0;

    try {
      const evRes = await fetch(
        `${BUBBLE_BASE}/Project_Evidence?constraints=${encodeURIComponent(JSON.stringify([
          { key: 'project_id', constraint_type: 'equals', value: clientId }
        ]))}&limit=200`,
        { headers: bh }
      );
      if (evRes.ok) {
        const records: any[] = (await evRes.json()).response?.results || [];
        totalEvidence = records.length;
        records.forEach(r => {
          const cat = r.category || 'OTHER';
          evidenceCounts[cat] = (evidenceCounts[cat] || 0) + 1;
        });
        const catLines = Object.entries(evidenceCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, count]) => {
            const titles = records
              .filter(r => (r.category || 'OTHER') === cat)
              .slice(0, 3)
              .map(r => r.title || r.source_text?.slice(0, 60))
              .filter(Boolean).join('; ');
            return `- ${cat}: ${count} item${count > 1 ? 's' : ''}${titles ? ` (e.g. ${titles})` : ''}`;
          }).join('\n');
        evidenceSummary = totalEvidence > 0
          ? `Client has ${totalEvidence} evidence items:\n${catLines}`
          : 'Client has no evidence items in their BidVault yet.';
      }
    } catch { /* non-fatal */ }

    // ── 3. Call Claude ───────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];

    const prompt = `You are an expert UK public sector bid consultant performing a Go/No-Go analysis.

TODAY: ${today}
TENDER: ${tenderName || file.name}
${buyerName ? `BUYER: ${buyerName}` : ''}
${buyerOrgType ? `BUYER TYPE: ${buyerOrgType}` : ''}

CLIENT'S BIDVAULT EVIDENCE LIBRARY:
${evidenceSummary}

TENDER DOCUMENT:
${tenderText.slice(0, 45000)}

Return a single valid JSON object — no markdown, no explanation — with EXACTLY this structure:

{
  "readinessScore": <number 0-10>,
  "recommendation": {
    "decision": <"BID" or "NO BID">,
    "confidence": <number 0-10>,
    "headline": <1-2 sentence summary>,
    "decisionFactors": [
      { "factor": <string>, "weight": <"Critical"|"High"|"Medium">, "score": <number 0-10>, "rationale": <string> }
    ]
  },
  "executiveSummary": {
    "oneLiner": <string>,
    "keyStrengths": [<string>],
    "keyWeaknesses": [<string>],
    "criticalGaps": [<string>],
    "winProbability": <"High (60%+)"|"Medium (35-60%)"|"Low (<35%)">
  },
  "tenderProfile": {
    "opportunityName": <string or null>,
    "buyerOrganisation": <string or null>,
    "buyerType": <string or null>,
    "sector": <string or null>,
    "region": <string or null>,
    "serviceCategories": [<string>],
    "procurementRoute": <string or null>,
    "contractDescription": <string or null>,
    "contractValue": {
      "annualValue": <number or null>,
      "totalValue": <number or null>,
      "valueRange": <string or null>
    },
    "contractTerm": {
      "initialTerm": <string or null>,
      "extensionOptions": <string or null>,
      "totalPossibleTerm": <string or null>
    },
    "portfolioSize": null
  },
  "keyDates": {
    "submissionDeadline": <ISO date string or null>,
    "clarificationDeadline": <ISO date string or null>,
    "contractStartDate": <ISO date string or null>,
    "daysUntilSubmission": <number or null>,
    "siteVisitDates": <string or null>,
    "awardDate": <ISO date string or null>,
    "mobilisationPeriod": <string or null>
  },
  "mandatoryRequirements": {
    "overallStatus": <"pass"|"at risk"|"fail">,
    "requirements": [
      {
        "requirement": <string>,
        "threshold": <string or null>,
        "status": <"met"|"partial"|"not met">,
        "ourPosition": <string or null>,
        "action": <string or null>
      }
    ]
  },
  "evidenceAnalysis": {
    "overallEvidenceCoverage": <string e.g. "72%">,
    "strongAreas": [<string>],
    "gapAreas": [
      {
        "area": <string>,
        "severity": <"Critical"|"Major"|"Minor">,
        "impact": <string or null>,
        "canWeAddress": <string or null>
      }
    ],
    "relevantCaseStudies": [
      { "title": <string>, "relevance": <string>, "strengthForTender": <"High"|"Medium"|"Low"> }
    ]
  },
  "evaluationModel": {
    "qualityWeighting": <number or null>,
    "priceWeighting": <number or null>,
    "qualityPriceRatio": <string or null>,
    "criteria": [
      {
        "criterion": <string>,
        "weighting": <number or null>,
        "ourStrength": <"Strong"|"Medium"|"Weak">,
        "evidenceGap": <string or null>
      }
    ]
  },
  "competitivePosition": {
    "winProbability": <"High (60%+)"|"Medium (35-60%)"|"Low (<35%)">",
    "ourDifferentiators": [<string>],
    "competitiveThreats": [<string>]
  },
  "riskAssessment": {
    "overallRisk": <"Low"|"Medium"|"High">,
    "risks": [
      {
        "category": <string>,
        "risk": <string>,
        "severity": <"High"|"Medium"|"Low">,
        "likelihood": <"High"|"Medium"|"Low">,
        "mitigation": <string or null>
      }
    ]
  },
  "nextSteps": [
    { "action": <string>, "priority": <"Immediate"|"This Week"|"Before Submission"> }
  ]
}

Rules:
- Score evidence strength against the client's actual BidVault items above — if they have no SOCIAL_VALUE items and the tender weights it heavily, that is a Critical gap
- daysUntilSubmission = days from ${today} to submission deadline (positive integer)
- Be specific to this tender — no generic advice
- Return ONLY the JSON object`;

    // ── 4. Run Claude + BidLearn fetch in parallel ───────────────────────────
    const bidlearnPromise = (async (): Promise<any> => {
      if (!buyerName && !buyerOrgType) return null;
      try {
        const constraints = (extra: object[] = []) =>
          encodeURIComponent(JSON.stringify([
            { key: 'client_id', constraint_type: 'equals', value: clientId },
            ...(buyerName ? [{ key: 'buyer_name', constraint_type: 'text contains', value: buyerName }] : []),
            ...extra,
          ]));
        const outcomeConstraints = encodeURIComponent(JSON.stringify([
          { key: 'client', constraint_type: 'equals', value: clientId },
          ...(buyerName ? [{ key: 'buyer_name', constraint_type: 'text contains', value: buyerName }] : []),
        ]));
        const [profileRes, negInsightsRes, posInsightsRes, outcomesRes] = await Promise.all([
          fetch(`${BUBBLE_BASE}/Buyer_Profile?constraints=${constraints()}&limit=1`, { headers: bh }),
          fetch(`${BUBBLE_BASE}/Outcome_Insight?constraints=${constraints([{ key: 'insight_type', constraint_type: 'equals', value: 'negative' }])}&limit=50`, { headers: bh }),
          fetch(`${BUBBLE_BASE}/Outcome_Insight?constraints=${constraints([{ key: 'insight_type', constraint_type: 'equals', value: 'positive' }])}&limit=50`, { headers: bh }),
          fetch(`${BUBBLE_BASE}/Bid_Outcome?constraints=${outcomeConstraints}&limit=50&sort_field=Created%20Date&descending=true`, { headers: bh }),
        ]);
        const profile = profileRes.ok ? (await profileRes.json()).response?.results?.[0] || null : null;
        const negativeInsights = negInsightsRes.ok ? (await negInsightsRes.json()).response?.results || [] : [];
        const positiveInsights = posInsightsRes.ok ? (await posInsightsRes.json()).response?.results || [] : [];
        const outcomes: any[] = outcomesRes.ok ? (await outcomesRes.json()).response?.results || [] : [];
        if (!profile && outcomes.length === 0) return null;
        const wins = outcomes.filter(o => o.outcome === 'win').length;
        const losses = outcomes.filter(o => o.outcome === 'loss').length;
        const winRate = outcomes.length > 0 ? wins / outcomes.length : 0;
        const catPos: Record<string, number> = {};
        const catNeg: Record<string, number> = {};
        positiveInsights.forEach((i: any) => { const c = i.category; if (c) catPos[c] = (catPos[c] || 0) + 1; });
        negativeInsights.forEach((i: any) => { const c = i.category; if (c) catNeg[c] = (catNeg[c] || 0) + 1; });
        const strongCats = Object.entries(catPos).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c).join(', ');
        const weakCats = Object.entries(catNeg).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c).join(', ');
        const derivedProfile = profile || { buyer_name: buyerName, total_bids: outcomes.length, wins, losses, win_rate: winRate, last_outcome: outcomes[0]?.outcome, strong_categories: strongCats || null, weak_categories: weakCats || null };
        const catLosses: Record<string, number> = {};
        negativeInsights.forEach((i: any) => { const cat = i.category; if (cat) catLosses[cat] = (catLosses[cat] || 0) + 1; });
        const lossWarnings = Object.entries(catLosses).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat, count]) => `${count} previous bid${count > 1 ? 's' : ''} with ${buyerName} scored weak on ${cat}`);
        let sectorProfile = null;
        const orgType = (profile?.buyer_org_type as string | undefined) || buyerOrgType;
        if (orgType) {
          const sRes = await fetch(`${BUBBLE_BASE}/Sector_Profile?constraints=${encodeURIComponent(JSON.stringify([{ key: 'org_type', constraint_type: 'equals', value: orgType }]))}&limit=1`, { headers: bh });
          if (sRes.ok) sectorProfile = (await sRes.json()).response?.results?.[0] || null;
        }
        return { hasPriorBids: true, profile: derivedProfile, recentInsights: negativeInsights.slice(0, 5), lossWarnings, sectorProfile };
      } catch { return null; }
    })();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
    let analysis: any = {};
    try {
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse analysis JSON. Stop reason:', response.stop_reason, 'Raw (first 500):', raw.slice(0, 500));
      return NextResponse.json({ error: 'Failed to parse analysis response', stop_reason: response.stop_reason, raw: raw.slice(0, 1000) }, { status: 500 });
    }

    // Override buyer fields with user-provided values
    if (analysis.tenderProfile) {
      if (buyerName) analysis.tenderProfile.buyerOrganisation = buyerName;
      if (buyerOrgType) analysis.tenderProfile.buyerType = buyerOrgType;
    }

    // Await BidLearn (already running in parallel with Claude)
    const bidlearnContext = await bidlearnPromise;

    // ── 5. Save to BidGate_Analysis in Bubble (fire and forget) ─────────────
    const savedName = analysis.tenderProfile?.opportunityName || tenderName || file.name;
    const savedDecision = analysis.recommendation?.decision || null;
    const savedScore = typeof analysis.readinessScore === 'number' ? analysis.readinessScore : (analysis.readinessScore?.overall ?? null);
    const savedWinProb = analysis.competitivePosition?.winProbability || analysis.executiveSummary?.winProbability || null;
    // Don't await — let it complete in background
    fetch(`${BUBBLE_BASE}/BidGate_Analysis`, {
      method: 'POST',
      headers: { ...bh, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        tender_name: savedName,
        buyer_name: buyerName || null,
        buyer_org_type: buyerOrgType || null,
        decision: savedDecision,
        readiness_score: savedScore,
        win_probability: savedWinProb,
        analysis_json: JSON.stringify(analysis),
      }),
    }).catch(() => { /* non-fatal — table may not exist yet */ });

    return NextResponse.json({
      success: true,
      analysis,
      tender_name: savedName,
      evidence_counts: evidenceCounts,
      total_evidence: totalEvidence,
      bidlearn: bidlearnContext,
      buyer_name: buyerName || null,
      buyer_org_type: buyerOrgType || null,
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('BidGate API error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
