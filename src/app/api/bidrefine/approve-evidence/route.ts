import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { clientId, tenderName, refinedDraftId, candidate } = await req.json();
    if (!clientId || !candidate?.text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Delegate to the existing BidVault record creation route — handles embedding automatically
    const res = await fetch(`${req.nextUrl.origin}/api/bidvault/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        category: candidate.category || 'OTHER',
        title: candidate.title || `${candidate.type || 'Evidence'} — ${tenderName || 'BidRefine'}`,
        value: candidate.value || candidate.text,
        source_text: `BidRefine | ${tenderName || 'unknown tender'} | refinement: ${refinedDraftId || ''}`,
        client_name: candidate.client_name || '',
        end_client_name: candidate.end_client_name || '',
        sector: candidate.sector || '',
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error || 'Failed to save', detail: data }, { status: 500 });
    }

    return NextResponse.json({ success: true, evidenceId: data.record_id });
  } catch (e: any) {
    console.error('approve-evidence error:', e);
    return NextResponse.json({ error: 'Failed', detail: e?.message }, { status: 500 });
  }
}
