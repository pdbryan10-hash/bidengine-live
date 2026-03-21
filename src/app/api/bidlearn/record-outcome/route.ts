export const maxDuration = 120;

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { processFeedbackAndUpdateProfile } from '@/lib/process-feedback';

const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';

export async function POST(req: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const {
      client,
      tender,
      tender_name,
      buyer_name,
      buyer_org_type,
      outcome,
      contract_value,
      feedback_raw,
      notes,
    } = body;

    if (!client || !tender_name || !buyer_name || !outcome) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const bubblePayload: Record<string, unknown> = {
      client,
      tender,
      tender_name,
      buyer_name,
      buyer_org_type,
      outcome,
      ...(contract_value && { contract_value }),
      ...(feedback_raw && { feedback_raw }),
      ...(notes && { notes }),
    };

    const res = await fetch(`${BUBBLE_API_BASE}/Bid_Outcome`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(bubblePayload),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: 'Failed to save outcome', detail: err }, { status: 500 });
    }

    const data = await res.json();
    const outcomeId: string = data.id;

    // Process feedback directly — no internal HTTP calls (they get killed on Vercel)
    if (feedback_raw && outcomeId) {
      await processFeedbackAndUpdateProfile({
        outcomeId, clientId: client, buyer_name, tender_name,
        tender_id: tender, outcome, feedback_raw, buyer_org_type,
      }).catch(() => {}); // non-fatal — outcome already saved
    }

    return NextResponse.json({ success: true, outcomeId });
  } catch (e: any) {
    console.error('record-outcome error:', e);
    return NextResponse.json({ error: 'Internal error', detail: e?.message }, { status: 500 });
  }
}
