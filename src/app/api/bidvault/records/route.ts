import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BUBBLE_API_URL = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '';

async function fetchPage(constraints: string, cursor: number, pageSize: number) {
  const response = await fetch(
    `${BUBBLE_API_URL}/Project_Evidence?constraints=${encodeURIComponent(constraints)}&limit=${pageSize}&cursor=${cursor}`,
    { headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` } }
  );
  if (!response.ok) return { records: [], remaining: 0 };
  const data = await response.json();
  return {
    records: data.response?.results || [],
    remaining: data.response?.remaining || 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const clientId = request.nextUrl.searchParams.get('clientId');
    if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

    const constraints = JSON.stringify([
      { key: 'project_id', constraint_type: 'equals', value: clientId }
    ]);
    const pageSize = 100;

    const first = await fetchPage(constraints, 0, pageSize);
    if (first.records.length === 0) return NextResponse.json({ records: [] });

    let allRecords = [...first.records];
    if (first.remaining > 0) {
      const extraPages = Math.min(Math.ceil(first.remaining / pageSize), 19);
      const cursors = Array.from({ length: extraPages }, (_, i) => (i + 1) * pageSize);
      const pages = await Promise.all(cursors.map(c => fetchPage(constraints, c, pageSize)));
      allRecords = [allRecords, ...pages.map(p => p.records)].flat();
    }

    // Strip embeddings before returning — large and not needed for UI
    const slim = allRecords.map(r => {
      const { embedding, ...rest } = r;
      return rest;
    });

    return NextResponse.json({ records: slim });
  } catch (err) {
    console.error('BidVault records error:', err);
    return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 });
  }
}
