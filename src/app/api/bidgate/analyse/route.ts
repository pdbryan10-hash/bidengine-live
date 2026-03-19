export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

const N8N_WEBHOOK_URL = process.env.BIDGATE_N8N_WEBHOOK_URL || 'https://bidengine.app.n8n.cloud/webhook/bidgate-analyse';

export async function POST(request: NextRequest) {
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();
    const fileType = fileName.endsWith('.pdf') ? 'pdf' :
                     fileName.endsWith('.docx') ? 'docx' :
                     fileName.endsWith('.doc') ? 'doc' : 'text';

    // Extract text server-side — avoids unreliable n8n binary extraction
    let tenderText = '';
    if (fileType === 'pdf') {
      const parsed = await pdfParse(buffer);
      tenderText = parsed.text;
    } else if (fileType === 'docx') {
      const result = await mammoth.extractRawText({ buffer });
      tenderText = result.value;
    } else {
      tenderText = buffer.toString('utf-8');
    }

    // Call n8n webhook with extracted text only — no binary needed
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        body: {
          clientId,
          tenderName: tenderName || file.name,
          fileName: file.name,
          fileType: 'text',
          tenderText: tenderText.substring(0, 50000),
        }
      }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('n8n error:', errorText);
      return NextResponse.json({ error: 'Analysis failed', details: errorText }, { status: 500 });
    }

    const result = await n8nResponse.json();

    // Handle both array and object responses from n8n
    const data = Array.isArray(result) ? result[0] : result;

    // Override tenderProfile with user-provided buyer info (GPT-4o can't know what the user typed)
    if (data.analysis?.tenderProfile) {
      if (buyerName) data.analysis.tenderProfile.buyerOrganisation = buyerName;
      if (buyerOrgType) data.analysis.tenderProfile.buyerType = buyerOrgType;
    }

    // Fetch BidLearn context directly from Bubble — no internal HTTP call
    let bidlearnContext = null;
    if (buyerName || buyerOrgType) {
      try {
        const BUBBLE_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
        const bh = { 'Authorization': `Bearer ${process.env.BUBBLE_API_KEY || ''}` };

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
        const outcomes: Record<string, unknown>[] = outcomesRes.ok ? (await outcomesRes.json()).response?.results || [] : [];

        if (profile || outcomes.length > 0) {
          const wins = outcomes.filter(o => o.outcome === 'win').length;
          const losses = outcomes.filter(o => o.outcome === 'loss').length;
          const winRate = outcomes.length > 0 ? wins / outcomes.length : 0;
          const lastOutcome = outcomes[0]?.outcome as string | undefined;

          // Derive strong/weak categories from Outcome_Insight records
          const catPos: Record<string, number> = {};
          const catNeg: Record<string, number> = {};
          positiveInsights.forEach((i: Record<string, unknown>) => { const c = i.category as string; if (c) catPos[c] = (catPos[c] || 0) + 1; });
          negativeInsights.forEach((i: Record<string, unknown>) => { const c = i.category as string; if (c) catNeg[c] = (catNeg[c] || 0) + 1; });
          const strongCats = Object.entries(catPos).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c).join(', ');
          const weakCats = Object.entries(catNeg).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c).join(', ');

          // Use Buyer_Profile if it exists, otherwise derive from outcomes
          const derivedProfile = profile || {
            buyer_name: buyerName,
            total_bids: outcomes.length,
            wins,
            losses,
            win_rate: winRate,
            last_outcome: lastOutcome,
            strong_categories: strongCats || null,
            weak_categories: weakCats || null,
          };

          const catLosses: Record<string, number> = {};
          negativeInsights.forEach((i: Record<string, unknown>) => {
            const cat = i.category as string;
            if (cat) catLosses[cat] = (catLosses[cat] || 0) + 1;
          });
          const lossWarnings = Object.entries(catLosses)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([cat, count]) => `${count} previous bid${count > 1 ? 's' : ''} with ${buyerName} scored weak on ${cat}`);

          let sectorProfile = null;
          const orgType = (profile?.buyer_org_type as string | undefined) || buyerOrgType;
          if (orgType) {
            const sRes = await fetch(`${BUBBLE_BASE}/Sector_Profile?constraints=${encodeURIComponent(JSON.stringify([{ key: 'org_type', constraint_type: 'equals', value: orgType }]))}&limit=1`, { headers: bh });
            if (sRes.ok) sectorProfile = (await sRes.json()).response?.results?.[0] || null;
          }

          bidlearnContext = { hasPriorBids: true, profile: derivedProfile, recentInsights: negativeInsights.slice(0, 5), lossWarnings, sectorProfile };
        }
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({
      success: data.success || true,
      analysis: data.analysis,
      tender_name: data.tender_name || tenderName || file.name,
      evidence_counts: data.evidence_counts,
      total_evidence: data.total_evidence,
      bidlearn: bidlearnContext,
      buyer_name: buyerName || null,
      buyer_org_type: buyerOrgType || null,
    });

  } catch (error) {
    console.error('BidGate API error:', error);
    return NextResponse.json(
      { error: 'Failed to analyse tender', details: String(error) },
      { status: 500 }
    );
  }
}
