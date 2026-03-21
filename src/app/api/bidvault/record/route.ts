import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BUBBLE_API_URL = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.substring(0, 8000) }),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.data[0].embedding;
}

export async function POST(request: NextRequest) {
  try {
    const { clientId, category, title, value, source_text, client_name, sector } = await request.json();

    if (!clientId || !category || !title) {
      return NextResponse.json({ error: 'clientId, category, and title are required' }, { status: 400 });
    }

    // Build embedding text from all meaningful fields
    const embeddingText = [title, value, source_text, client_name, category, sector]
      .filter(Boolean)
      .join(' ');

    // Generate embedding in parallel with Bubble record creation
    const [embeddingResult, createResponse] = await Promise.all([
      generateEmbedding(embeddingText),
      fetch(`${BUBBLE_API_URL}/Project_Evidence`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BUBBLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: clientId,
          category,
          title,
          value: value || '',
          source_text: source_text || '',
          client_name: client_name || '',
          sector: sector || '',
        }),
      }),
    ]);

    if (!createResponse.ok) {
      const err = await createResponse.text();
      console.error('Bubble create error:', err);
      return NextResponse.json({ error: 'Failed to create record in Bubble' }, { status: 500 });
    }

    const created = await createResponse.json();
    const recordId = created.id;

    // Write embedding back to record if we got one
    if (embeddingResult.length > 0 && recordId) {
      await fetch(`${BUBBLE_API_URL}/Project_Evidence/${recordId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${BUBBLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ embedding: JSON.stringify(embeddingResult) }),
      });
    }

    return NextResponse.json({ success: true, record_id: recordId });
  } catch (err) {
    console.error('BidVault record create error:', err);
    return NextResponse.json({ error: 'Failed to create record' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { recordId, title, value, source_text, client_name, sector, category } = await request.json();

    if (!recordId) {
      return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
    }

    const updateBody: Record<string, string> = {};
    if (title !== undefined) updateBody.title = title;
    if (value !== undefined) updateBody.value = value;
    if (source_text !== undefined) updateBody.source_text = source_text;
    if (client_name !== undefined) updateBody.client_name = client_name;
    if (sector !== undefined) updateBody.sector = sector;

    // Regenerate embedding from updated content
    const embeddingText = [title, value, source_text, client_name, category, sector].filter(Boolean).join(' ');
    if (embeddingText) {
      const embedding = await generateEmbedding(embeddingText);
      if (embedding.length > 0) updateBody.embedding = JSON.stringify(embedding);
    }

    const res = await fetch(`${BUBBLE_API_URL}/Project_Evidence/${recordId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(updateBody),
    });

    if (!res.ok) {
      console.error('Bubble update error:', await res.text());
      return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('BidVault record update error:', err);
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { recordId } = await request.json();

    if (!recordId) {
      return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
    }

    const res = await fetch(`${BUBBLE_API_URL}/Project_Evidence/${recordId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` },
    });

    if (!res.ok) {
      console.error('Bubble delete error:', await res.text());
      return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('BidVault record delete error:', err);
    return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
  }
}
