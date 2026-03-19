/**
 * Semantic Search for BidEngine
 * Uses OpenAI embeddings to find relevant evidence based on meaning, not just keywords
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// OpenAI embedding model - text-embedding-3-small is cheap and effective
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536; // Default for text-embedding-3-small

export interface EvidenceWithEmbedding {
  _id: string;
  title: string;
  value: string;
  source_text: string;
  category: string;
  client_name?: string;
  project_id: string;
  embedding?: number[];
  sector?: string; // Optional sector for sector-boosting in search
}

export interface SemanticSearchResult {
  evidence: EvidenceWithEmbedding;
  similarity: number;
}

/**
 * Generate embedding for a text using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured - semantic search disabled');
    return [];
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.substring(0, 8000), // Max ~8k tokens for embedding
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI embedding error:', error);
      return [];
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    return [];
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Search evidence by semantic similarity
 * Returns top K most relevant evidence records
 * 
 * FAST MODE: If embeddings are pre-stored in Bubble, this is instant
 * FALLBACK: If no embeddings stored, generates them (slower, but works)
 */
export async function semanticSearch(
  query: string,
  evidenceRecords: EvidenceWithEmbedding[],
  topK: number = 20
): Promise<SemanticSearchResult[]> {
  // Generate embedding for the query (just 1 API call - fast)
  const queryEmbedding = await generateEmbedding(query);
  
  if (queryEmbedding.length === 0) {
    console.warn('Query embedding failed - returning all evidence');
    return evidenceRecords.map(e => ({ evidence: e, similarity: 0 }));
  }

  // Count how many have pre-stored embeddings vs need generation
  const withEmbedding = evidenceRecords.filter(e => e.embedding && e.embedding.length > 0);
  const needsEmbedding = evidenceRecords.filter(e => !e.embedding || e.embedding.length === 0);
  
  console.log(`Evidence: ${withEmbedding.length} have embeddings, ${needsEmbedding.length} need generation`);

  // If most records have embeddings, use them (fast path)
  if (withEmbedding.length > needsEmbedding.length) {
    console.log('Using pre-stored embeddings (fast mode)');
    
    // Calculate similarity only for records with embeddings
    const scored: SemanticSearchResult[] = withEmbedding.map(evidence => ({
      evidence,
      similarity: cosineSimilarity(queryEmbedding, evidence.embedding!)
    }));
    
    // Sort and return top K
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK);
  }

  // Fallback: Generate embeddings for records that don't have them
  // This is slower but ensures it still works with old data
  if (needsEmbedding.length > 0 && needsEmbedding.length <= 100) {
    console.log(`Generating ${needsEmbedding.length} embeddings (fallback mode)...`);
    
    const texts = needsEmbedding.map(e => 
      `${e.title || ''} ${e.value || ''} ${e.source_text || ''}`
    );
    const embeddings = await batchGenerateEmbeddings(texts);
    
    // Assign embeddings back
    for (let i = 0; i < needsEmbedding.length; i++) {
      needsEmbedding[i].embedding = embeddings[i];
    }
  } else if (needsEmbedding.length > 100) {
    // Too many to generate on-the-fly - skip semantic search
    console.warn(`Too many records without embeddings (${needsEmbedding.length}) - using keyword fallback`);
    return evidenceRecords.map(e => ({ evidence: e, similarity: 0.5 }));
  }

  // Calculate similarity for ALL evidence records
  const scored: SemanticSearchResult[] = [];
  
  for (const evidence of evidenceRecords) {
    if (evidence.embedding && evidence.embedding.length > 0) {
      const similarity = cosineSimilarity(queryEmbedding, evidence.embedding);
      scored.push({ evidence, similarity });
    }
  }

  // Sort by similarity (highest first) and return top K
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topK);
}

/**
 * Generate embedding for an evidence record (for storage)
 * Call this when uploading new evidence to BidVault
 */
export async function generateEvidenceEmbedding(evidence: {
  title?: string;
  value?: string;
  source_text?: string;
}): Promise<number[]> {
  const text = [
    evidence.title || '',
    evidence.value || '',
    evidence.source_text || ''
  ].filter(Boolean).join(' ');
  
  return generateEmbedding(text);
}

/**
 * Batch generate embeddings for multiple evidence records
 * More efficient than calling one at a time
 */
export async function batchGenerateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (!OPENAI_API_KEY || texts.length === 0) {
    return texts.map(() => []);
  }

  try {
    // OpenAI supports batch embeddings
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts.map(t => t.substring(0, 8000)),
      }),
    });

    if (!response.ok) {
      console.error('OpenAI batch embedding error:', await response.text());
      return texts.map(() => []);
    }

    const data = await response.json();
    return data.data.map((d: any) => d.embedding);
  } catch (error) {
    console.error('Failed to batch generate embeddings:', error);
    return texts.map(() => []);
  }
}

/**
 * Enhanced evidence search that combines semantic + keyword matching
 * Best of both worlds
 */
export async function hybridSearch(
  query: string,
  evidenceRecords: EvidenceWithEmbedding[],
  topK: number = 25,
  tenderSector?: string
): Promise<SemanticSearchResult[]> {
  // 1. Semantic search (meaning-based)
  const semanticResults = await semanticSearch(query, evidenceRecords, topK * 2);
  
  // 2. Keyword boost - if query terms appear in evidence, boost the score
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);
  
  const boosted = semanticResults.map(result => {
    const text = `${result.evidence.title} ${result.evidence.value} ${result.evidence.source_text}`.toLowerCase();
    
    // Count keyword matches
    let keywordBoost = 0;
    for (const term of queryTerms) {
      if (text.includes(term)) {
        keywordBoost += 0.05; // 5% boost per matching keyword
      }
    }
    
    // Boost exact category matches and governance keywords
    const queryLower = query.toLowerCase();
    if (queryLower.includes('safety') && result.evidence.category === 'SAFETY') keywordBoost += 0.1;
    if (queryLower.includes('mobilisation') && result.evidence.category === 'MOBILISATION') keywordBoost += 0.1;
    if (queryLower.includes('compliance') && result.evidence.category === 'KPI') keywordBoost += 0.1;
    if (queryLower.includes('energy') && result.evidence.category === 'SUSTAINABILITY') keywordBoost += 0.1;
    if (queryLower.includes('sustainability') && result.evidence.category === 'SUSTAINABILITY') keywordBoost += 0.1;
    
    // GOVERNANCE BOOST - Strong boost for governance-related questions
    const isGovernanceQuery = queryLower.includes('governance') || 
                             queryLower.includes('monitoring') || 
                             queryLower.includes('oversight') || 
                             queryLower.includes('review') || 
                             queryLower.includes('meeting') || 
                             queryLower.includes('escalation') || 
                             queryLower.includes('kpi') || 
                             queryLower.includes('reporting') || 
                             queryLower.includes('dashboard') || 
                             queryLower.includes('audit') || 
                             queryLower.includes('steering') || 
                             queryLower.includes('committee') || 
                             queryLower.includes('framework') || 
                             queryLower.includes('structure') ||
                             // Expanded governance concept detection
                             queryLower.includes('management approach') ||
                             queryLower.includes('service model') ||
                             queryLower.includes('performance monitoring') ||
                             queryLower.includes('continuous improvement') ||
                             queryLower.includes('how you manage') ||
                             queryLower.includes('how do you manage') ||
                             queryLower.includes('describe your approach') ||
                             queryLower.includes('explain your approach') ||
                             queryLower.includes('outline your approach') ||
                             queryLower.includes('detail your approach') ||
                             queryLower.includes('set out your approach') ||
                             queryLower.includes('management system') ||
                             queryLower.includes('performance management') ||
                             queryLower.includes('service delivery') ||
                             queryLower.includes('client management') ||
                             queryLower.includes('contract management') ||
                             queryLower.includes('stakeholder management') ||
                             queryLower.includes('communication') ||
                             queryLower.includes('accountability') ||
                             queryLower.includes('transparency');
                             
    const isGovernanceEvidence = result.evidence.category === 'GOVERNANCE' || 
                                result.evidence.category === 'KPI' || 
                                result.evidence.category === 'MONITORING' || 
                                result.evidence.category === 'REPORTING' || 
                                result.evidence.category === 'MANAGEMENT' || 
                                result.evidence.category === 'PROCESS' || 
                                result.evidence.category === 'SERVICE_DELIVERY' || 
                                result.evidence.title?.toLowerCase().includes('governance') || 
                                result.evidence.title?.toLowerCase().includes('monitoring') || 
                                result.evidence.title?.toLowerCase().includes('kpi') || 
                                result.evidence.title?.toLowerCase().includes('dashboard') || 
                                result.evidence.title?.toLowerCase().includes('meeting') || 
                                result.evidence.title?.toLowerCase().includes('review') || 
                                result.evidence.title?.toLowerCase().includes('escalation') || 
                                result.evidence.title?.toLowerCase().includes('reporting') || 
                                result.evidence.title?.toLowerCase().includes('framework') || 
                                result.evidence.title?.toLowerCase().includes('process') || 
                                result.evidence.title?.toLowerCase().includes('management') || 
                                result.evidence.value?.toLowerCase().includes('monthly review') || 
                                result.evidence.value?.toLowerCase().includes('weekly meeting') || 
                                result.evidence.value?.toLowerCase().includes('quarterly audit') || 
                                result.evidence.value?.toLowerCase().includes('steering group') || 
                                result.evidence.value?.toLowerCase().includes('escalation') || 
                                result.evidence.value?.toLowerCase().includes('governance');
    
    // ALWAYS boost governance evidence - every FM tender question benefits from explicit governance
    if (isGovernanceEvidence) {
      keywordBoost += 0.40; // 40% boost for governance evidence
      console.log(`GOVERNANCE BOOST: boosting evidence ${result.evidence._id} - ${result.evidence.title}`);
    }
    
    // BOOST ALL KEY FM CATEGORIES - every question benefits from strong evidence across all areas
    const category = result.evidence.category?.toUpperCase() || '';
    const title = result.evidence.title?.toLowerCase() || '';
    const value = result.evidence.value?.toLowerCase() || '';
    
    // Safety evidence - always valuable
    if (category === 'SAFETY' || category === 'HEALTH_SAFETY' || title.includes('safety') || title.includes('riddor') || title.includes('incident')) {
      keywordBoost += 0.30;
      console.log(`SAFETY BOOST: ${result.evidence._id} - ${result.evidence.title}`);
    }
    
    // Resources/Mobilisation evidence - scalability, teams, deployment
    if (category === 'RESOURCES' || category === 'MOBILISATION' || title.includes('mobilisation') || title.includes('tupe') || title.includes('resource') || title.includes('staff') || title.includes('team')) {
      keywordBoost += 0.30;
      console.log(`RESOURCES BOOST: ${result.evidence._id} - ${result.evidence.title}`);
    }
    
    // Quality/Compliance evidence
    if (category === 'QUALITY' || category === 'COMPLIANCE' || title.includes('compliance') || title.includes('quality') || title.includes('iso') || title.includes('audit')) {
      keywordBoost += 0.30;
      console.log(`QUALITY BOOST: ${result.evidence._id} - ${result.evidence.title}`);
    }
    
    // Performance/KPI evidence - metrics, SLAs, targets
    if (category === 'FINANCIALS' || category === 'PERFORMANCE' || title.includes('sla') || title.includes('ppm') || title.includes('kpi') || value.includes('% completion') || value.includes('% compliance')) {
      keywordBoost += 0.30;
      console.log(`PERFORMANCE BOOST: ${result.evidence._id} - ${result.evidence.title}`);
    }
    
    // Social Value evidence
    if (category === 'SOCIAL_VALUE' || title.includes('apprentice') || title.includes('social value') || title.includes('community') || title.includes('volunteer')) {
      keywordBoost += 0.30;
      console.log(`SOCIAL VALUE BOOST: ${result.evidence._id} - ${result.evidence.title}`);
    }
    
    // Innovation/Sustainability evidence
    if (category === 'INNOVATION' || category === 'SUSTAINABILITY' || title.includes('innovation') || title.includes('carbon') || title.includes('energy') || title.includes('sustainability')) {
      keywordBoost += 0.30;
      console.log(`INNOVATION BOOST: ${result.evidence._id} - ${result.evidence.title}`);
    }
    
    // Client Feedback/Testimonials - always powerful
    if (category === 'CLIENT_FEEDBACK' || category === 'TESTIMONIAL' || title.includes('testimonial') || title.includes('feedback') || title.includes('satisfaction')) {
      keywordBoost += 0.35;
      console.log(`TESTIMONIAL BOOST: ${result.evidence._id} - ${result.evidence.title}`);
    }
    
    // SECTOR BOOST - 50% boost if evidence sector matches tender sector
    if (tenderSector && result.evidence.sector) {
      const evidenceSector = result.evidence.sector.toLowerCase();
      const targetSector = tenderSector.toLowerCase();
      if (evidenceSector.includes(targetSector) || targetSector.includes(evidenceSector)) {
        keywordBoost += 0.50; // 50% boost for sector match - prioritise same-sector evidence
        console.log(`SECTOR MATCH: ${evidenceSector} matches ${targetSector} - boosting evidence ${result.evidence._id}`);
      }
    }
    
    return {
      ...result,
      similarity: Math.min(1, result.similarity + keywordBoost) // Cap at 1.0
    };
  });
  
  // Re-sort after boosting
  boosted.sort((a, b) => b.similarity - a.similarity);
  return boosted.slice(0, topK);
}

/**
 * Format search results for Claude prompt
 */
export function formatSearchResultsForPrompt(results: SemanticSearchResult[]): string {
  return results.map(r => {
    const e = r.evidence;
    return `[${e.category}] ${e.client_name || 'Unknown Client'}
ID: ${e._id}
Title: ${e.title || 'N/A'}
Value: ${e.value || 'N/A'}
Details: ${e.source_text || 'N/A'}
Relevance: ${(r.similarity * 100).toFixed(1)}%`;
  }).join('\n\n---\n\n');
}
