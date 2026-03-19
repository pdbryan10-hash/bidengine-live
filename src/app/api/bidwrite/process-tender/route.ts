import { NextRequest, NextResponse } from 'next/server';
import { callClaude, rateLimitDelay, logRateLimitStatus, estimateTokens } from '@/lib/claude';

// Vercel Pro allows up to 300 seconds, Hobby is 10 seconds
export const maxDuration = 60;

const BUBBLE_API_URL = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '33cb561a966f59ad7ea5e29a1906bf36';

// Fetch all evidence for a client from single Project_Evidence table
async function fetchAllEvidence(clientId: string): Promise<any[]> {
  const allEvidence: any[] = [];
  
  try {
    const constraints = JSON.stringify([
      { key: 'project_id', constraint_type: 'equals', value: clientId }
    ]);
    
    const response = await fetch(
      `${BUBBLE_API_URL}/Project_Evidence?constraints=${encodeURIComponent(constraints)}&limit=500`,
      {
        headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` },
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      const records = data.response?.results || [];
      records.forEach((record: any) => {
        allEvidence.push({
          table: record.category || 'OTHER',
          evidence_id: record._id,
          client_name: record.client_name || record.end_client_name || 'Unknown',
          ...record
        });
      });
    }
  } catch (err) {
    console.error('Failed to fetch evidence:', err);
  }
  
  return allEvidence;
}

// Format evidence for prompt
function formatEvidence(evidence: any[]): string {
  if (evidence.length === 0) return 'No evidence available in BidVault.';
  
  const formatted = evidence.slice(0, 40).map(e => {
    const fields = Object.entries(e)
      .filter(([k, v]) => !['_id', 'Created Date', 'Modified Date', 'Created By', 'project_id'].includes(k) && v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n  ');
    return `[${e.table}] ID: ${e.evidence_id}\n  ${fields}`;
  }).join('\n\n');
  
  return formatted.substring(0, 15000);
}

// Generate response using Claude
async function generateResponse(questionText: string, evidence: string): Promise<string> {
  const prompt = `You are an expert bid writer who creates winning tender responses. 

CORE PRINCIPLES:
1. Only use evidence from the BidVault - never invent statistics
2. Cite evidence: [Client Name | evidence_id]
3. Use evidence from DIFFERENT clients to show breadth
4. If no evidence exists, mark as [EVIDENCE GAP: description]
5. British English, professional tone
6. Focus on outcomes and metrics

QUESTION:
${questionText}

EVIDENCE LIBRARY:
${evidence}

Write a 600-800 word response with citations:`;

  const message = await callClaude(
    [{ role: 'user', content: prompt }],
    { 
      maxTokens: 2000,
      estimatedInputTokens: estimateTokens(prompt)
    }
  );
  
  const content = message.content[0];
  return content.type === 'text' ? content.text : '';
}

// Score response using Claude
async function scoreResponse(questionText: string, answerText: string): Promise<{ score: number; evaluation: string }> {
  const prompt = `You are BidScore. Evaluate this tender response 0-10.

OUTPUT FORMAT:
SCORE: [X.X]/10
SUMMARY: [2-3 sentences]
STRENGTHS: [bullet points]
MUST FIX: [critical gaps]
SHOULD FIX: [improvements]

QUESTION:
${questionText}

RESPONSE:
${answerText}

Evaluate:`;

  const message = await callClaude(
    [{ role: 'user', content: prompt }],
    { 
      maxTokens: 1500,
      estimatedInputTokens: estimateTokens(prompt)
    }
  );
  
  const content = message.content[0];
  const evaluation = content.type === 'text' ? content.text : '';
  const scoreMatch = evaluation.match(/SCORE:\s*(\d+\.?\d*)/i);
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
  
  return { score, evaluation };
}

// Improve response using Claude
async function improveResponse(questionText: string, answerText: string, evaluation: string, evidence: string): Promise<string> {
  const prompt = `Improve this tender response based on feedback.

Address ALL MUST FIX items. Keep 600-900 words. Every claim needs [Client | ID] citation.

QUESTION:
${questionText}

CURRENT RESPONSE:
${answerText}

FEEDBACK:
${evaluation}

EVIDENCE:
${evidence}

Write improved response:`;

  const message = await callClaude(
    [{ role: 'user', content: prompt }],
    { 
      maxTokens: 2000,
      estimatedInputTokens: estimateTokens(prompt)
    }
  );
  
  const content = message.content[0];
  return content.type === 'text' ? content.text : '';
}

// Main handler
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { tender_id, client_id, questions } = body;
    
    if (!tender_id || !client_id) {
      return NextResponse.json({ error: 'Missing tender_id or client_id' }, { status: 400 });
    }
    
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
    }
    
    // Fetch evidence
    const evidence = await fetchAllEvidence(client_id);
    const formattedEvidence = formatEvidence(evidence);
    
    // Get questions if not provided
    let questionsToProcess = questions;
    if (!questionsToProcess) {
      const constraints = JSON.stringify([
        { key: 'tender', constraint_type: 'equals', value: tender_id }
      ]);
      const questionsResponse = await fetch(
        `${BUBBLE_API_URL}/tender_questions?constraints=${encodeURIComponent(constraints)}&limit=100`,
        { headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` } }
      );
      
      if (questionsResponse.ok) {
        const data = await questionsResponse.json();
        questionsToProcess = data.response?.results || [];
      } else {
        return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
      }
    }
    
    if (questionsToProcess.length === 0) {
      return NextResponse.json({ success: true, tender_id, questionsProcessed: 0, results: [] });
    }
    
    const results: any[] = [];
    
    for (const question of questionsToProcess) {
      // Add delay between questions to respect rate limits
      if (results.length > 0) {
        await rateLimitDelay();
      }
      
      const questionId = question._id;
      const questionText = question.question_text;
      
      try {
        // Generate
        let answer = await generateResponse(questionText, formattedEvidence);
        
        // Score
        let { score, evaluation } = await scoreResponse(questionText, answer);
        
        // Loop if needed
        let loopCount = 0;
        while (score < 8.5 && loopCount < 2) {
          answer = await improveResponse(questionText, answer, evaluation, formattedEvidence);
          const newScore = await scoreResponse(questionText, answer);
          score = newScore.score;
          evaluation = newScore.evaluation;
          loopCount++;
        }
        
        // Save to Bubble
        await fetch(`${BUBBLE_API_URL}/tender_questions/${questionId}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${BUBBLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            answer_text: answer,
            final_evaluation: evaluation,
            score: score,
            status: 'draft',
            loop_count: loopCount,
            processed_at: new Date().toISOString(),
            processing_source: 'nextjs-claude',
          }),
        });
        
        results.push({ questionId, questionNumber: question.question_number, score, loopCount, success: true });
      } catch (err: any) {
        results.push({ questionId, questionNumber: question.question_number, success: false, error: err.message });
      }
    }
    
    const runTime = Math.round((Date.now() - startTime) / 1000);
    
    // Update tender
    await fetch(`${BUBBLE_API_URL}/Tenders%20Data%20Type/${tender_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        processed_at: new Date().toISOString(),
        processing_time_seconds: runTime,
      }),
    });
    
    return NextResponse.json({
      success: true,
      tender_id,
      questionsProcessed: results.length,
      results,
      runTimeSeconds: runTime,
      evidenceCount: evidence.length,
    });
    
  } catch (error: any) {
    console.error('Process tender error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
