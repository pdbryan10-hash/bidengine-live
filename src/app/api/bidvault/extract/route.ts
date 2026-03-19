import { NextRequest, NextResponse } from 'next/server';

// n8n webhook URL
const N8N_WEBHOOK_URL = process.env.N8N_BIDVAULT_WEBHOOK || 'https://bidengine.app.n8n.cloud/webhook/bidvault-extract';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const clientId = formData.get('clientId') as string;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    if (!clientId) {
      return NextResponse.json({ error: 'No clientId provided' }, { status: 400 });
    }

    // Extract text from the file
    const documentText = await extractTextFromFile(file);
    
    if (!documentText || documentText.trim().length === 0) {
      return NextResponse.json({ error: 'Could not extract text from file' }, { status: 400 });
    }

    // Call n8n webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document_text: documentText,
        document_name: file.name,
        client_id: clientId
      })
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('n8n webhook error:', errorText);
      return NextResponse.json({ 
        error: 'Extraction failed', 
        details: errorText 
      }, { status: 500 });
    }

    const result = await n8nResponse.json();
    
    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('BidVault extraction error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function extractTextFromFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.pdf')) {
    return extractTextFromPDF(buffer);
  } else if (fileName.endsWith('.docx')) {
    return extractTextFromDOCX(buffer);
  } else if (fileName.endsWith('.doc')) {
    // Old .doc format - try basic extraction
    return extractTextFromDOC(buffer);
  } else if (fileName.endsWith('.txt')) {
    return buffer.toString('utf-8');
  }
  
  // Fallback - try to read as text
  return buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r]/g, ' ');
}

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    // @ts-ignore - pdf-parse has no type definitions
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import of mammoth
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Failed to extract text from DOCX');
  }
}

async function extractTextFromDOC(buffer: Buffer): Promise<string> {
  // Old .doc format is tricky - try basic text extraction
  // This won't work well for complex documents
  const text = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r]/g, ' ');
  
  // If we got mostly garbage, throw error
  if (text.trim().length < 100) {
    throw new Error('Cannot extract text from old .doc format. Please convert to .docx');
  }
  
  return text;
}
