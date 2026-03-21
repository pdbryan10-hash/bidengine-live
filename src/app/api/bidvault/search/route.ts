import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hybridSearch } from '@/lib/semantic';

const BUBBLE_API_URL = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '';

interface EvidenceRecord {
  _id: string;
  title?: string;
  value?: string;
  source_text?: string;
  category?: string;
  client_name?: string;
  end_client_name?: string;
  project_id?: string;
  sector?: string;
  embedding?: number[] | string;
  [key: string]: any;
}

async function fetchPage(constraints: string, cursor: number, pageSize: number): Promise<{ records: EvidenceRecord[]; remaining: number }> {
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

async function fetchAllEvidence(clientId: string): Promise<EvidenceRecord[]> {
  const constraints = JSON.stringify([
    { key: 'project_id', constraint_type: 'equals', value: clientId }
  ]);
  const pageSize = 100;

  // Page 1 — need the remaining count before we can parallelise
  const first = await fetchPage(constraints, 0, pageSize);
  if (first.records.length === 0) return [];

  if (first.remaining === 0) return first.records;

  // Fire all remaining pages in parallel
  const extraPages = Math.min(Math.ceil(first.remaining / pageSize), 19); // cap at 2000 records
  const cursors = Array.from({ length: extraPages }, (_, i) => (i + 1) * pageSize);
  const pages = await Promise.all(cursors.map(c => fetchPage(constraints, c, pageSize)));

  return [first.records, ...pages.map(p => p.records)].flat();
}

export async function POST(request: NextRequest) {
  try {
    const { clientId, query, topK = 15 } = await request.json();

    if (!clientId || !query?.trim()) {
      return NextResponse.json({ error: 'clientId and query required' }, { status: 400 });
    }

    const rawRecords = await fetchAllEvidence(clientId);

    const records = rawRecords.map(r => ({
      _id: r._id,
      title: r.title || '',
      value: r.value || '',
      source_text: r.source_text || '',
      category: r.category || 'OTHER',
      client_name: r.client_name || r.end_client_name || '',
      project_id: r.project_id || '',
      sector: r.sector || '',
      embedding: r.embedding
        ? (typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding)
        : undefined,
    }));

    const results = await hybridSearch(query.trim(), records, topK);

    return NextResponse.json({
      results: results.map(r => ({
        _id: r.evidence._id,
        title: r.evidence.title,
        value: r.evidence.value,
        source_text: r.evidence.source_text,
        category: r.evidence.category,
        client_name: r.evidence.client_name,
        sector: r.evidence.sector,
        relevance: Math.round(r.similarity * 100),
      })),
      total_records: rawRecords.length,
    });
  } catch (err) {
    console.error('BidVault search error:', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
