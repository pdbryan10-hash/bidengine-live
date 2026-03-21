import { BidOutcome, BuyerProfile, OutcomeInsight } from '@/types';

const BUBBLE_API_KEY = process.env.NEXT_PUBLIC_BUBBLE_API_KEY || process.env.BUBBLE_API_KEY || '';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';

const headers = () => ({ 'Authorization': `Bearer ${BUBBLE_API_KEY}`, 'Content-Type': 'application/json' });

export async function fetchBidOutcomes(clientId: string): Promise<BidOutcome[]> {
  try {
    const constraints = JSON.stringify([{ key: 'client', constraint_type: 'equals', value: clientId }]);
    const url = `${BUBBLE_API_BASE}/Bid_Outcome?constraints=${encodeURIComponent(constraints)}&limit=100&sort_field=Created%20Date&descending=true`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) {
      console.error('fetchBidOutcomes failed:', res.status, await res.text());
      return [];
    }
    const data = await res.json();
    return data.response?.results || [];
  } catch (e) { console.error('fetchBidOutcomes error:', e); return []; }
}

export async function fetchBuyerProfiles(clientId: string): Promise<BuyerProfile[]> {
  try {
    const constraints = JSON.stringify([{ key: 'client_id', constraint_type: 'equals', value: clientId }]);
    const url = `${BUBBLE_API_BASE}/Buyer_Profile?constraints=${encodeURIComponent(constraints)}&limit=100&sort_field=wins&descending=true`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.response?.results || [];
  } catch { return []; }
}

export async function fetchBuyerProfile(clientId: string, buyerName: string): Promise<BuyerProfile | null> {
  try {
    const constraints = JSON.stringify([
      { key: 'client_id', constraint_type: 'equals', value: clientId },
      { key: 'buyer_name', constraint_type: 'equals', value: buyerName },
    ]);
    const url = `${BUBBLE_API_BASE}/Buyer_Profile?constraints=${encodeURIComponent(constraints)}&limit=1`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.response?.results?.[0] || null;
  } catch { return null; }
}

export async function fetchOutcomeInsights(clientId: string, buyerName: string): Promise<OutcomeInsight[]> {
  try {
    const constraints = JSON.stringify([
      { key: 'client_id', constraint_type: 'equals', value: clientId },
      { key: 'buyer_name', constraint_type: 'equals', value: buyerName },
    ]);
    const url = `${BUBBLE_API_BASE}/Outcome_Insight?constraints=${encodeURIComponent(constraints)}&limit=100`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.response?.results || [];
  } catch { return []; }
}

export function formatBuyerContextForPrompt(profile: BuyerProfile, lossWarnings: string[]): string {
  const winPct = Math.round(profile.win_rate * 100);
  const lines = [
    `BUYER: ${profile.buyer_name}${profile.buyer_org_type ? ` (${profile.buyer_org_type})` : ''}`,
    `WIN RATE WITH THIS BUYER: ${winPct}% (${profile.wins} wins from ${profile.total_bids} bids)`,
  ];
  if (profile.strong_categories) lines.push(`CATEGORIES THAT SCORE WELL: ${profile.strong_categories}`);
  if (profile.weak_categories) lines.push(`CATEGORIES THAT SCORE POORLY: ${profile.weak_categories}`);
  if (profile.evaluator_priorities) lines.push(`WHAT THIS BUYER VALUES: ${profile.evaluator_priorities}`);
  if (lossWarnings.length > 0) lines.push(`WARNINGS: ${lossWarnings.join('; ')}`);
  lines.push('Use this intelligence to prioritise evidence from strong categories and address known weak areas.');
  return lines.join('\n');
}
