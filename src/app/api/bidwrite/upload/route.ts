import { NextRequest, NextResponse } from 'next/server';
import { callClaude, estimateTokens } from '@/lib/claude';

export const maxDuration = 120;

// @ts-ignore - pdf-parse doesn't have types
const pdf = require('pdf-parse');

const BUBBLE_API_URL = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '33cb561a966f59ad7ea5e29a1906bf36';

// Extract text from PDF
async function extractPdfText(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, 'base64');
  const data = await pdf(buffer);
  return data.text;
}

// Use Claude to extract questions from document text - handles large docs by chunking
async function extractQuestions(text: string): Promise<any[]> {
  console.log('extractQuestions called, text length:', text?.length || 0);
  
  if (!text || text.trim().length < 50) {
    console.error('Text too short or empty:', text?.substring(0, 100));
    return [];
  }
  
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set');
    return [];
  }
  
  const CHUNK_SIZE = 28000;
  const chunks = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.substring(i, i + CHUNK_SIZE));
  }
  
  console.log(`Splitting into ${chunks.length} chunks for extraction`);
  
  const allQuestions: any[] = [];
  const seenNumbers = new Set<string>();
  
  for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
    const chunk = chunks[chunkIdx];
    console.log(`Processing chunk ${chunkIdx + 1} of ${chunks.length}`);
    
    const prompt = `You are an expert at extracting tender questions from documents. 
Extract all questions that require a written response from this section of the document.

${seenNumbers.size > 0 ? `Already extracted question numbers: ${Array.from(seenNumbers).join(', ')} — skip these if they appear again.` : ''}

CRITICAL: question_text must contain the COMPLETE question content, not just a title or heading.
If a question has a title/heading AND descriptive text, combine them.
Example: If the document shows "Q1: Service Model" followed by "Describe your approach to service delivery including governance structures, monitoring arrangements, and escalation procedures" - the question_text should be the FULL text: "Service Model: Describe your approach to service delivery including governance structures, monitoring arrangements, and escalation procedures"

Return a JSON array with objects containing:
- question_number: string (e.g., "Q1", "1.1", "A1")  
- question_text: string (the COMPLETE question - include the title AND all descriptive text, sub-questions, and requirements. This should be 20-200 words typically, NOT just a 2-3 word title)
- section: string (the section name if identifiable, otherwise "General")
- word_limit: number or null (if specified)
- weighting: string or null (if specified, e.g., "20%")

IMPORTANT: If question_text is less than 10 words, you've probably only captured the title. Go back and find the full question description.

Only return the JSON array, no other text. If no new questions found, return [].

Document section ${chunkIdx + 1} of ${chunks.length}:

${chunk}`;

    try {
      const message = await callClaude(
        [{ role: 'user', content: prompt }],
        { 
          maxTokens: 4000,
          estimatedInputTokens: estimateTokens(prompt)
        }
      );

      const content = message.content[0];
      let responseText = content.type === 'text' ? content.text : '';
      
      let jsonStr = responseText;
      if (responseText.includes('```')) {
        jsonStr = responseText.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      }
      
      const chunkQuestions = JSON.parse(jsonStr);
      console.log(`Chunk ${chunkIdx + 1} returned ${chunkQuestions.length} questions`);
      
      // Dedup by question number
      for (const q of chunkQuestions) {
        const num = String(q.question_number);
        if (!seenNumbers.has(num)) {
          seenNumbers.add(num);
          allQuestions.push(q);
        }
      }
    } catch (e) {
      console.error(`Chunk ${chunkIdx + 1} extraction failed:`, e);
    }
  }
  
  console.log('Total questions extracted:', allQuestions.length);
  return allQuestions;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      clientId,
      tenderId,
      tenderName,
      sector,
      fileName,
      fileType,
      fileBase64,
      extractedText 
    } = body;

    console.log('Upload API called:', {
      clientId,
      tenderId,
      tenderName,
      fileName,
      fileType,
      hasFileBase64: !!fileBase64,
      extractedTextLength: extractedText?.length || 0
    });

    if (!clientId) {
      return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY not found in environment');
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }

    // Get document text
    let documentText = extractedText;
    if (!documentText && fileBase64) {
      console.log('Extracting text from PDF...');
      documentText = await extractPdfText(fileBase64);
    }
    
    console.log('Document text length:', documentText?.length || 0);
    console.log('Document text preview:', documentText?.substring(0, 200));

    if (!documentText) {
      return NextResponse.json({ error: 'No document text provided' }, { status: 400 });
    }

    // Extract questions using AI
    const questions = await extractQuestions(documentText);
    
    console.log('Questions extracted:', questions.length);
    console.log('Questions:', JSON.stringify(questions).substring(0, 500));

    if (questions.length === 0) {
      return NextResponse.json({ 
        error: 'No questions found in document',
        documentTextLength: documentText.length,
        documentPreview: documentText.substring(0, 300)
      }, { status: 400 });
    }

    // Use existing tenderId if provided, otherwise create new tender
    let finalTenderId = tenderId;
    
    if (!finalTenderId) {
      // Create tender in Bubble
      const tenderResponse = await fetch(`${BUBBLE_API_URL}/Tenders%20Data%20Type`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BUBBLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tender_name: tenderName || 'Untitled Tender',
          client: clientId,
          source_file: fileName,
          status: 'processing',
          question_count: questions.length,
          sector: sector || '',
        }),
      });

      if (!tenderResponse.ok) {
        const error = await tenderResponse.text();
        console.error('Failed to create tender:', error);
        return NextResponse.json({ error: 'Failed to create tender' }, { status: 500 });
      }

      const tenderData = await tenderResponse.json();
      finalTenderId = tenderData.id;
    } else {
      // Update existing tender with question count
      await fetch(`${BUBBLE_API_URL}/Tenders%20Data%20Type/${finalTenderId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${BUBBLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_file: fileName,
          status: 'processing',
          question_count: questions.length,
          sector: sector || '',
        }),
      });
    }

    // Create questions in Bubble
    const questionResults = [];
    console.log('Creating', questions.length, 'questions in Bubble...');
    
    for (const q of questions) {
      console.log('Creating question:', q.question_number);
      
      const questionResponse = await fetch(`${BUBBLE_API_URL}/tender_questions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BUBBLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_number: String(q.question_number),
          question_text: q.question_text,
          section: q.section || 'General',
          tender: finalTenderId,
          client: clientId,
          status: 'pending',
        }),
      });

      if (questionResponse.ok) {
        const qData = await questionResponse.json();
        console.log('Question created:', qData.id);
        questionResults.push({
          _id: qData.id,
          question_number: q.question_number,
          question_text: q.question_text,
        });
      } else {
        const errorText = await questionResponse.text();
        console.error('Failed to create question:', q.question_number, questionResponse.status, errorText);
      }
    }

    return NextResponse.json({
      success: true,
      tender_id: finalTenderId,
      tender_name: tenderName,
      questions_created: questionResults.length,
      questions: questionResults,
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
