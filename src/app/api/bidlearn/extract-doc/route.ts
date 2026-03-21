export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileBase64, fileName } = body;

    if (!fileBase64 || !fileName) {
      return NextResponse.json({ error: 'Missing fileBase64 or fileName' }, { status: 400 });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const ext = fileName.toLowerCase().split('.').pop();

    let text = '';

    if (ext === 'pdf') {
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (ext === 'docx' || ext === 'doc') {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use PDF or Word (.docx).' }, { status: 400 });
    }

    return NextResponse.json({ text: text.trim() });
  } catch (error: any) {
    console.error('BidLearn extract-doc error:', error);
    return NextResponse.json({ error: 'Failed to extract text from document' }, { status: 500 });
  }
}
