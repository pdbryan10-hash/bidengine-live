import { TenderQuestion, Tender, BubbleResponse, ParsedScore, Project, ProjectCaseStudy } from '@/types';

const BUBBLE_API_KEY = '33cb561a966f59ad7ea5e29a1906bf36';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';

// ==================== CLIENT LOOKUP ====================

// Fetch all clients (admin only)
export async function fetchAllClients(): Promise<Array<{
  _id: string;
  client_id: number;
  client_name: string;
  email?: string;
  subscription_status?: string;
  is_admin?: boolean;
  'Created Date'?: string;
}>> {
  try {
    const response = await fetch(
      `${BUBBLE_API_BASE}/Clients?limit=100&sort_field=client_name&descending=false`,
      { headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` } }
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.response.results || [];
  } catch (error) {
    console.error('Failed to fetch all clients:', error);
    return [];
  }
}

// Check if a client is admin
export async function checkIsAdmin(clerkUserId: string): Promise<boolean> {
  try {
    const client = await fetchClientByClerkId(clerkUserId);
    if (!client) return false;
    return (client as any).is_admin === true;
  } catch (error) {
    console.error('Failed to check admin status:', error);
    return false;
  }
}

export async function fetchClientByClerkId(clerkUserId: string, clerkOrgId?: string): Promise<{_id: string, client_id: number, client_name: string, subscription_status?: string, stripe_customer_id?: string, trial_end_date?: string, is_admin?: boolean} | null> {
  try {
    // 1. Try direct user ID match (account owner)
    const constraints = JSON.stringify([
      { key: 'Clerk_user_id', constraint_type: 'equals', value: clerkUserId }
    ]);
    const response = await fetch(
      `${BUBBLE_API_BASE}/Clients?constraints=${encodeURIComponent(constraints)}`,
      { headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` } }
    );
    if (!response.ok) {
      console.error('Bubble API error:', response.status, await response.text());
      return null;
    }
    const data = await response.json();
    if (data.response.results.length > 0) {
      return data.response.results[0];
    }

    // 2. Fallback: try org ID match (team member joining via Clerk organisation)
    if (clerkOrgId) {
      const orgConstraints = JSON.stringify([
        { key: 'clerk_org_id', constraint_type: 'equals', value: clerkOrgId }
      ]);
      const orgResponse = await fetch(
        `${BUBBLE_API_BASE}/Clients?constraints=${encodeURIComponent(orgConstraints)}`,
        { headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` } }
      );
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        if (orgData.response.results.length > 0) {
          console.log('Matched client via org ID', clerkOrgId);
          return orgData.response.results[0];
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch client:', error);
    return null;
  }
}

// Create a new client record
export async function createClient(
  clerkUserId: string, 
  email: string, 
  name: string,
  stripeCustomerId: string,
  subscriptionStatus: string = 'trialing',
  trialEndDate?: string
): Promise<{_id: string, client_id: number} | null> {
  try {
    // Generate unique client_id using timestamp
    const uniqueClientId = Date.now();
    
    const response = await fetch(`${BUBBLE_API_BASE}/Clients`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Clerk_user_id: clerkUserId,
        client_id: uniqueClientId,
        client_name: name,
        email: email,
        stripe_customer_id: stripeCustomerId,
        subscription_status: subscriptionStatus,
        trial_end_date: trialEndDate,
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to create client:', await response.text());
      return null;
    }
    
    const data = await response.json();
    return { _id: data.id, client_id: uniqueClientId };
  } catch (error) {
    console.error('Failed to create client:', error);
    return null;
  }
}

// Update client subscription status
export async function updateClientSubscription(
  stripeCustomerId: string,
  subscriptionStatus: string,
  subscriptionId?: string,
  trialEndDate?: string,
  currentPeriodEnd?: string
): Promise<boolean> {
  try {
    // First find the client by stripe_customer_id
    const constraints = JSON.stringify([
      { key: 'stripe_customer_id', constraint_type: 'equals', value: stripeCustomerId }
    ]);
    const findResponse = await fetch(
      `${BUBBLE_API_BASE}/Clients?constraints=${encodeURIComponent(constraints)}`,
      { headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` } }
    );
    
    if (!findResponse.ok) return false;
    const findData = await findResponse.json();
    if (findData.response.results.length === 0) return false;
    
    const clientId = findData.response.results[0]._id;
    
    // Update the client
    const updateData: any = {
      subscription_status: subscriptionStatus,
    };
    if (subscriptionId) updateData.stripe_subscription_id = subscriptionId;
    if (trialEndDate) updateData.trial_end_date = trialEndDate;
    if (currentPeriodEnd) updateData.subscription_end_date = currentPeriodEnd;
    
    const updateResponse = await fetch(`${BUBBLE_API_BASE}/Clients/${clientId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    
    return updateResponse.ok;
  } catch (error) {
    console.error('Failed to update client subscription:', error);
    return false;
  }
}

// Fetch client by Bubble ID
export async function fetchClientById(clientId: string): Promise<{
  _id: string;
  client_id: number;
  client_name: string;
  user_name?: string;
  subscription_status?: string;
  stripe_customer_id?: string;
  trial_end_date?: string;
  subscription_end_date?: string;
} | null> {
  try {
    const response = await fetch(
      `${BUBBLE_API_BASE}/Clients/${clientId}`,
      { headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Failed to fetch client by ID:', error);
    return null;
  }
}

// ==================== BIDVAULT API ====================

export async function fetchProjects(clientId?: string): Promise<Project[]> {
  try {
    let url = `${BUBBLE_API_BASE}/Projects?limit=100&sort_field=Created%20Date&descending=true`;
    
    if (clientId) {
      const constraints = JSON.stringify([
        { key: 'client', constraint_type: 'equals', value: clientId }
      ]);
      url += `&constraints=${encodeURIComponent(constraints)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${BUBBLE_API_KEY}`,
      },
    });
    if (!response.ok) return [];
    const data: BubbleResponse<Project> = await response.json();
    return data.response.results;
  } catch (error) {
    console.error('Failed to fetch projects:', error);
    return [];
  }
}

// Evidence categories - all stored in single Project_Evidence table
export const EVIDENCE_CATEGORIES = [
  { category: 'SAFETY', label: 'Safety' },
  { category: 'FINANCIAL', label: 'Financials' },
  { category: 'SOCIAL_VALUE', label: 'Social Value' },
  { category: 'QUALITY', label: 'Quality' },
  { category: 'INNOVATION', label: 'Innovation' },
  { category: 'SUSTAINABILITY', label: 'Sustainability' },
  { category: 'CLIENT_FEEDBACK', label: 'Client Feedback' },
  { category: 'SUPPLY_CHAIN', label: 'Supply Chain' },
  { category: 'GOVERNANCE', label: 'Governance' },
  { category: 'INCIDENT', label: 'Incidents' },
  { category: 'PROGRAMME', label: 'Programme' },
  { category: 'RESOURCE', label: 'Resources' },
  { category: 'KPI', label: 'KPIs' },
  { category: 'CASE_STUDY', label: 'Case Studies' },
  { category: 'MOBILISATION', label: 'Mobilisation' },
  { category: 'OTHER', label: 'Other' },
];

// Legacy support - map old table names to categories
export const EVIDENCE_TABLES = EVIDENCE_CATEGORIES.map(c => ({
  name: `Project_Evidence`,
  label: c.label,
  category: c.category,
  titleField: 'title',
  narrativeField: 'source_text'
}));

// Get table config by name (legacy) or category
export function getTableConfig(tableName: string) {
  return EVIDENCE_TABLES.find(t => t.name === tableName || t.category === tableName);
}

// Fetch a single evidence record by ID
export async function fetchEvidenceById(evidenceId: string): Promise<any | null> {
  try {
    const response = await fetch(
      `${BUBBLE_API_BASE}/Project_Evidence/${evidenceId}`,
      { headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.response || null;
  } catch (error) {
    console.error('Failed to fetch evidence by ID:', error);
    return null;
  }
}

// Fetch all evidence records for a client, optionally filtered by category
export async function fetchEvidenceRecords(category: string | null, clientId: string): Promise<any[]> {
  try {
    const constraints: any[] = [
      { key: 'project_id', constraint_type: 'equals', value: clientId }
    ];
    if (category && category !== 'Project_Evidence') {
      constraints.push({ key: 'category', constraint_type: 'equals', value: category });
    }

    const pageSize = 100;
    const baseUrl = `${BUBBLE_API_BASE}/Project_Evidence?constraints=${encodeURIComponent(JSON.stringify(constraints))}&limit=${pageSize}&sort_field=Modified%20Date&descending=true&_t=${Date.now()}`;

    // Fetch first page to get total remaining count
    const firstRes = await fetch(`${baseUrl}&cursor=0`, {
      headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` },
      cache: 'no-store',
    });
    if (!firstRes.ok) return [];
    const firstData = await firstRes.json();
    const firstPage = firstData.response?.results || [];
    const remaining = firstData.response?.remaining || 0;
    if (remaining === 0) return firstPage;

    // Fire all remaining pages in parallel
    const totalPages = Math.ceil(remaining / pageSize);
    const pages = await Promise.all(
      Array.from({ length: totalPages }, (_, i) => {
        const cursor = (i + 1) * pageSize;
        if (cursor > 5000) return Promise.resolve([]);
        return fetch(`${baseUrl}&cursor=${cursor}`, {
          headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` },
          cache: 'no-store',
        })
          .then(r => r.ok ? r.json() : null)
          .then(d => d?.response?.results || [])
          .catch(() => []);
      })
    );

    return [...firstPage, ...pages.flat()];
  } catch (error) {
    console.error('Failed to fetch evidence records:', error);
    return [];
  }
}

// Fetch all evidence for a client (all categories)
export async function fetchAllEvidence(clientId: string): Promise<any[]> {
  return fetchEvidenceRecords(null, clientId);
}

export interface EvidenceTableData {
  label: string;
  count: number;
  lastUploadDate?: string;
  lastUploadTitle?: string;
  lastUploadNarrative?: string;
}

export interface EvidenceCounts {
  [key: string]: EvidenceTableData;
}

export async function fetchEvidenceCounts(clientId: string): Promise<EvidenceCounts> {
  const counts: EvidenceCounts = {};
  try {
    // Fire one request per category in parallel — limit=1 gives us remaining for the total count
    await Promise.all(
      EVIDENCE_CATEGORIES.map(async (cat) => {
        try {
          const constraints = JSON.stringify([
            { key: 'project_id', constraint_type: 'equals', value: clientId },
            { key: 'category', constraint_type: 'equals', value: cat.category }
          ]);
          const url = `${BUBBLE_API_BASE}/Project_Evidence?constraints=${encodeURIComponent(constraints)}&limit=1&sort_field=Created%20Date&descending=true&_t=${Date.now()}`;
          const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` },
            cache: 'no-store',
          });
          if (!response.ok) {
            counts[cat.category] = { label: cat.label, count: 0 };
            return;
          }
          const data = await response.json();
          const results = data.response?.results || [];
          const remaining = data.response?.remaining || 0;
          const latest = results[0] || null;
          counts[cat.category] = {
            label: cat.label,
            count: results.length + remaining,
            lastUploadDate: latest?.['Created Date'],
            lastUploadTitle: latest?.title || '',
            lastUploadNarrative: latest?.source_text || '',
          };
        } catch {
          counts[cat.category] = { label: cat.label, count: 0 };
        }
      })
    );
  } catch (error) {
    console.error('Error fetching evidence counts:', error);
    EVIDENCE_CATEGORIES.forEach(cat => {
      counts[cat.category] = { label: cat.label, count: 0 };
    });
  }
  return counts;
}

// ==================== BIDWRITE API ====================

export async function fetchTenders(clientId?: string): Promise<Tender[]> {
  try {
    let url = `${BUBBLE_API_BASE}/Tenders%20Data%20Type?sort_field=Created%20Date&descending=true&limit=50`;
    
    if (clientId) {
      const constraints = JSON.stringify([
        { key: 'client', constraint_type: 'equals', value: clientId }
      ]);
      url += `&constraints=${encodeURIComponent(constraints)}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${BUBBLE_API_KEY}`,
      },
    });
    if (!response.ok) return [];
    const data: BubbleResponse<Tender> = await response.json();
    return data.response.results;
  } catch (error) {
    console.error('Failed to fetch tenders:', error);
    return [];
  }
}

export async function fetchQuestions(tenderId: string, clientId?: string): Promise<TenderQuestion[]> {
  try {
    // Always filter by tender - this is what makes the dropdown work
    const constraints = JSON.stringify([
      { key: 'tender', constraint_type: 'equals', value: tenderId }
    ]);
    const url = `${BUBBLE_API_BASE}/tender_questions?limit=100&constraints=${encodeURIComponent(constraints)}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${BUBBLE_API_KEY}`,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch questions');
    }
    const data: BubbleResponse<TenderQuestion> = await response.json();
    return data.response.results;
  } catch (error) {
    console.error('Failed to fetch questions:', error);
    return [];
  }
}

export async function updateQuestion(id: string, updates: Partial<TenderQuestion>): Promise<void> {
  const response = await fetch(`${BUBBLE_API_BASE}/tender_questions/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${BUBBLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    throw new Error('Failed to update question');
  }
}

export interface EvidenceCitation {
  client: string;
  evidenceId: string;
  claim: string;
  verified?: boolean;
}

export interface ActionableImprovement {
  action: string;
  impact: string;
  how: string;
}

export interface FullEvaluation {
  score: number;
  maxScore: number;
  summary: string;
  complianceChecks: string[];
  evidenceQuality: string[];
  evidenceCitations: EvidenceCitation[];
  evidenceVerification: string[];
  governanceChecks: string[];
  bannedWords: string[];
  unverifiableClaims: string[];
  evidenceGaps: string[];
  actionableImprovements: ActionableImprovement[];
  gapAnalysis: {
    mustFix: string[];
    shouldFix: string[];
    couldFix: string[];
  };
  topImprovements: string[];
  scorePotential: string;
  scoreBreakdown: string[];
}

// Extract citations from answer text [Client Name | evidence_id]
export function extractCitationsFromAnswer(answerText: string): EvidenceCitation[] {
  if (!answerText) return [];
  
  const citations: EvidenceCitation[] = [];
  // Match pattern: [Client Name | evidence_id] - handles various formats
  const regex = /\[([^\|\]]+)\s*\|\s*(?:ID:\s*)?(\d+x\d+)\]/g;
  let match;
  
  while ((match = regex.exec(answerText)) !== null) {
    const client = match[1].trim();
    const evidenceId = match[2].trim();
    
    // Try to extract the claim (text before the citation)
    const beforeCitation = answerText.substring(0, match.index);
    const sentences = beforeCitation.split(/[.!?]/);
    const lastSentence = sentences[sentences.length - 1]?.trim() || '';
    
    // Avoid duplicates
    if (!citations.find(c => c.evidenceId === evidenceId)) {
      citations.push({
        client,
        evidenceId,
        claim: lastSentence.length > 100 ? lastSentence.substring(lastSentence.length - 100) : lastSentence,
        verified: undefined // Will be set by verification
      });
    }
  }
  
  return citations;
}

// Format answer with numbered superscript references instead of inline citations
export function formatAnswerWithReferences(answerText: string): { cleanText: string; references: Array<{ number: number; title: string; evidenceId: string; category: string }> } {
  if (!answerText) return { cleanText: '', references: [] };
  
  const references: Array<{ number: number; title: string; evidenceId: string; category: string }> = [];
  const seenIds = new Map<string, number>();
  let refNumber = 1;
  
  // Handle multiple formats:
  // [Client Name | ID]
  // [Client Name | ID & ID2]
  // [Client Name | ID & ID2 & ID3]
  // [1] simple numbered refs
  let cleanText = answerText.replace(/\[([^\[\]]+?)\s*\|\s*([^\[\]]+)\]/g, (match, client, idsString) => {
    const trimmedClient = client.trim();
    // Split by & to handle multiple IDs
    const ids = idsString.split(/\s*&\s*/).map((id: string) => id.replace(/^(?:ID:\s*)?/, '').trim()).filter((id: string) => /^\d+x\d+$/.test(id));
    
    if (ids.length === 0) return match; // No valid IDs found, keep original
    
    const refNums: number[] = [];
    
    ids.forEach((trimmedId: string) => {
      // Check if we've seen this ID before
      if (seenIds.has(trimmedId)) {
        refNums.push(seenIds.get(trimmedId)!);
      } else {
        // Add new reference
        seenIds.set(trimmedId, refNumber);
        references.push({
          number: refNumber,
          title: trimmedClient,
          evidenceId: trimmedId,
          category: ''
        });
        refNums.push(refNumber);
        refNumber++;
      }
    });
    
    // Create clickable superscript refs
    return refNums.map(num => {
      const id = Array.from(seenIds.entries()).find(([_, n]) => n === num)?.[0] || '';
      return `<sup class="citation-ref cursor-pointer text-cyan-400 hover:text-cyan-300" data-evidence-id="${id}">[${num}]</sup>`;
    }).join('');
  });
  
  // Also handle plain [n] references that might already exist
  cleanText = cleanText.replace(/\[(\d+)\](?!<\/sup>)/g, (match, num) => {
    return `<sup class="citation-ref cursor-pointer text-cyan-400 hover:text-cyan-300">[${num}]</sup>`;
  });
  
  return { cleanText, references };
}

export function parseFullEvaluation(evaluation: string): FullEvaluation {
  if (!evaluation) {
    return {
      score: 0,
      maxScore: 10,
      summary: '',
      complianceChecks: [],
      evidenceQuality: [],
      evidenceCitations: [],
      evidenceVerification: [],
      governanceChecks: [],
      bannedWords: [],
      unverifiableClaims: [],
      evidenceGaps: [],
      actionableImprovements: [],
      gapAnalysis: { mustFix: [], shouldFix: [], couldFix: [] },
      topImprovements: [],
      scorePotential: '',
      scoreBreakdown: [],
    };
  }

  // Score - handles "## Overall Score: 8.8/10" format
  const scoreMatch = evaluation.match(/Overall Score:\s*(\d+\.?\d*)\/(\d+)/i);
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
  const maxScore = scoreMatch ? parseFloat(scoreMatch[2]) : 10;

  // Summary - text between score line and first --- or ## section
  const summaryMatch = evaluation.match(/Overall Score:.*?\n([\s\S]*?)(?=\n---|\n##)/i);
  let summary = summaryMatch ? summaryMatch[1].trim() : '';
  
  // Fallback: if no summary found, grab first non-empty line after score
  if (!summary) {
    const afterScore = evaluation.match(/Overall Score:.*?\n(.+)/i);
    if (afterScore) {
      summary = afterScore[1].replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
    }
  }

  // Helper to extract section items - handles ## Section headers
  const extractSection = (sectionName: string): string[] => {
    const regex = new RegExp(`## ${sectionName}[\\s\\S]*?\\n([\\s\\S]*?)(?=\\n---|\n##|$)`, 'i');
    const match = evaluation.match(regex);
    if (!match) return [];
    return match[1]
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('✓') || line.trim().startsWith('•') || line.trim().startsWith('**'))
      .map(line => line.trim().replace(/^[-✓•]\s*/, ''));
  };

  // Extract Strengths (new format) - these become complianceChecks for display
  const strengths = extractSection('Strengths');
  
  // Extract Evidence section - parse into EvidenceCitation objects
  const evidenceMatch = evaluation.match(/## Evidence[:\s]*(\d+)\s*citations/i);
  const evidenceLines = extractSection('Evidence');
  const evidenceCitations: EvidenceCitation[] = evidenceLines.map(line => {
    // Parse format: "1769623832775x487752394426136800 | Metropolitan Borough Council | ISO-aligned HSMS..."
    const parts = line.split('|').map(p => p.trim());
    return {
      evidenceId: parts[0] || '',
      client: parts[1] || '',
      claim: parts[2] || line,
      verified: true
    };
  });
  
  // Extract Minor Deductions
  const deductionsMatch = evaluation.match(/## Minor Deductions\n([\s\S]*?)(?=\n---|\n##|$)/i);
  const deductions: string[] = [];
  if (deductionsMatch) {
    const lines = deductionsMatch[1].split('\n').filter(l => l.trim().startsWith('**-'));
    lines.forEach(line => {
      // Match format: **-0.2 | Vague phrasing:** or **-0.2 | text**
      const match = line.match(/\*\*(-[\d.]+)\s*\|\s*([^*]+)/);
      if (match) {
        const text = match[2].replace(/\*\*$/, '').replace(/:$/, '').trim();
        deductions.push(`${match[1]}: ${text}`);
      }
    });
  }

  // Gap Analysis - declare early so Actions parser can populate it
  const gapAnalysis = { mustFix: [] as string[], shouldFix: [] as string[], couldFix: [] as string[] };

  // Extract Actions/Improvements
  const actionsMatch = evaluation.match(/## Actions[^\n]*\n([\s\S]*?)(?=\n---|\n##|$)/i);
  const actionableImprovements: Array<{action: string; impact: string; how: string}> = [];
  const actionsAsGaps: string[] = [];
  if (actionsMatch) {
    const text = actionsMatch[1];
    
    // Check if Actions section contains MUST FIX / SHOULD FIX / COULD FIX format
    const hasMustFix = text.match(/(?:🔴\s*)?MUST FIX[:\s]*([\s\S]*?)(?=(?:🟠|🟢|SHOULD FIX|COULD FIX|$))/i);
    const hasShouldFix = text.match(/(?:🟠\s*)?SHOULD FIX[:\s]*([\s\S]*?)(?=(?:🟢|COULD FIX|$))/i);
    const hasCouldFix = text.match(/(?:🟢\s*)?COULD FIX[:\s]*([\s\S]*?)$/i);
    
    const extractItems = (content: string): string[] => {
      if (!content) return [];
      // Handle both "- item" and inline "text" formats
      const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const items: string[] = [];
      const cleanMarkdown = (s: string) => s
        .replace(/\*\*/g, '')
        .replace(/^[-•→]\s*/, '')
        .replace(/^\d+\.\s*/, '')
        .replace(/^(must fix|should fix|could fix)[:\s]*/i, '')
        .replace(/^🔴\s*|^🟠\s*|^🟢\s*/g, '')
        .trim();
      const isNone = (s: string) => {
        const lower = s.toLowerCase();
        return !s || lower === 'none' || lower === 'none.' || lower === 'n/a' || 
               lower.includes('none identified') || lower.includes('none –') ||
               lower.includes('none -') || lower === 'none – response meets tender requirements with evidence.' ||
               lower.startsWith('none –') || lower.startsWith('none -') || s.length <= 3;
      };
      lines.forEach(line => {
        const cleaned = cleanMarkdown(line);
        if (!isNone(cleaned)) {
          items.push(cleaned);
        }
      });
      // If no line items found, treat the whole content as one item
      if (items.length === 0) {
        const singleItem = cleanMarkdown(content);
        if (!isNone(singleItem)) {
          items.push(singleItem);
        }
      }
      return items;
    };
    
    if (hasMustFix) {
      gapAnalysis.mustFix = extractItems(hasMustFix[1]);
    }
    if (hasShouldFix) {
      gapAnalysis.shouldFix = extractItems(hasShouldFix[1]);
    }
    if (hasCouldFix) {
      gapAnalysis.couldFix = extractItems(hasCouldFix[1]);
    }
    
    // Fallback: old dash-list format
    if (gapAnalysis.mustFix.length === 0 && gapAnalysis.shouldFix.length === 0 && gapAnalysis.couldFix.length === 0) {
      const items = text.split('\n').filter(l => l.trim().startsWith('-'));
      items.forEach(item => {
        const cleaned = item.replace(/^-\s*/, '').trim();
        if (cleaned && !cleaned.toLowerCase().includes('none required')) {
          actionableImprovements.push({
            action: cleaned,
            impact: '+0.1-0.2',
            how: 'Optional refinement'
          });
          actionsAsGaps.push(cleaned);
        }
      });
    }
  }

  // Legacy format support - Compliance Check, Evidence Quality, etc
  const complianceChecks = strengths.length > 0 ? strengths : extractSection('Compliance Check');
  const evidenceQuality = extractSection('Evidence Quality');
  const governanceChecks = extractSection('Governance/Monitoring/Repeatability Check');

  // Banned Words (legacy format)
  const bannedMatch = evaluation.match(/## Banned Words Found\n([\s\S]*?)(?=\n---)/i);
  const bannedWords = bannedMatch 
    ? bannedMatch[1].split('\n').filter(l => l.trim() && l.trim() !== '- none' && l.trim() !== 'none').map(l => l.trim().replace(/^-\s*/, ''))
    : [];

  // Unverifiable Claims (legacy format)
  const unverifiableMatch = evaluation.match(/## Unverifiable Claims Found\n([\s\S]*?)(?=\n---)/i);
  const unverifiableClaims = unverifiableMatch
    ? unverifiableMatch[1].split('\n').filter(l => l.trim() && !l.toLowerCase().includes('none')).map(l => l.trim().replace(/^-\s*/, ''))
    : [];

  // What's Missing / Evidence Gaps
  const whatsMissingMatch = evaluation.match(/## What's Missing[\s\S]*?\n([\s\S]*?)(?=\n---)/i);
  const evidenceGaps = whatsMissingMatch
    ? whatsMissingMatch[1].split('\n')
        .filter(l => l.trim().startsWith('-') && !l.toLowerCase().includes('comprehensive'))
        .map(l => l.trim().replace(/^-\s*/, ''))
    : [];

  // Gap Analysis - check both old and new formats (gapAnalysis already declared above)
  // Only run if Actions section didn't already populate gaps
  const alreadyHasGaps = gapAnalysis.mustFix.length > 0 || gapAnalysis.shouldFix.length > 0 || gapAnalysis.couldFix.length > 0;
  
  if (!alreadyHasGaps) {
    const gapMatch = evaluation.match(/## Gap Analysis[\s\S]*?\n([\s\S]*?)(?=\n---|\n##|$)/i);
    
    // If no Gap Analysis section, check Minor Deductions for gaps
    if (!gapMatch && deductions.length > 0) {
      deductions.forEach(d => {
        if (d.startsWith('-0.5') || d.startsWith('-1')) {
          gapAnalysis.mustFix.push(d);
        } else if (d.startsWith('-0.2') || d.startsWith('-0.3')) {
          gapAnalysis.shouldFix.push(d);
        } else {
          gapAnalysis.couldFix.push(d);
        }
      });
    } else if (gapMatch) {
      const gapText = gapMatch[1];
      const mustFixMatch = gapText.match(/(?:🔴\s*)?MUST FIX:?([\s\S]*?)(?=(?:🟠|SHOULD FIX|🟢|COULD FIX|$))/i);
      const shouldFixMatch = gapText.match(/(?:🟠\s*)?SHOULD FIX:?([\s\S]*?)(?=(?:🟢|COULD FIX|$))/i);
      const couldFixMatch = gapText.match(/(?:🟢\s*)?COULD FIX:?([\s\S]*?)$/i);
      
      const extractGapItems = (text: string): string[] => {
        if (!text) return [];
        return text.split('\n')
          .map(line => line.trim()
            .replace(/\*\*/g, '')
            .replace(/^[-•]\s*/, '')
            .replace(/^\d+\.\s*/, '')
            .replace(/^(must fix|should fix|could fix)[:\s]*/i, '')
            .replace(/^🔴\s*|^🟠\s*|^🟢\s*/g, '')
            .trim()
          )
          .filter(cleaned => {
            if (!cleaned) return false;
            const lower = cleaned.toLowerCase();
            if (lower === 'none' || lower === 'none.' || lower === 'n/a' ||
                lower.includes('none identified') || lower.startsWith('none –') || 
                lower.startsWith('none -') || cleaned.length <= 3) return false;
            if (lower.includes('well-structured') || lower.includes('excellent') || 
                lower.includes('strong') || lower.includes('comprehensive') ||
                lower.includes('good') || lower.includes('clear')) {
              return false;
            }
            return true;
          });
      };

      if (mustFixMatch) gapAnalysis.mustFix = extractGapItems(mustFixMatch[1]);
      if (shouldFixMatch) gapAnalysis.shouldFix = extractGapItems(shouldFixMatch[1]);
      if (couldFixMatch) gapAnalysis.couldFix = extractGapItems(couldFixMatch[1]);
    }
  }

  // Add Actions as couldFix items if no other gaps found
  if (actionsAsGaps.length > 0 && gapAnalysis.couldFix.length === 0) {
    gapAnalysis.couldFix = actionsAsGaps;
  }

  // If still no gaps found, try to extract from summary text
  if (gapAnalysis.mustFix.length === 0 && gapAnalysis.shouldFix.length === 0 && gapAnalysis.couldFix.length === 0) {
    // Look for "minor gap", "gap in", "lacking", "missing" patterns in summary
    const gapPatterns = [
      /minor gap in ([^.;]+)/gi,
      /gap in demonstrating ([^.;]+)/gi,
      /lacking ([^.;]+)/gi,
      /missing ([^.;]+)/gi,
      /could improve ([^.;]+)/gi,
      /needs? more ([^.;]+)/gi,
      /limited ([^.;]+)/gi,
      /no specific ([^.;]+)/gi,
      /vague ([^.;]+)/gi,
    ];
    
    const extractedGaps: string[] = [];
    gapPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(summary)) !== null) {
        if (match[1] && match[1].trim().length > 5) {
          extractedGaps.push(match[1].trim());
        }
      }
    });
    
    // Also check for deduction reasons in summary
    const deductionPattern = /(?:minor )?deduction for ([^.;]+)/gi;
    let deductionMatch;
    while ((deductionMatch = deductionPattern.exec(summary)) !== null) {
      const reason = deductionMatch[1].trim();
      if (reason.length > 5) extractedGaps.push(reason);
    }
    
    // Add unique gaps as couldFix
    const uniqueGaps = Array.from(new Set(extractedGaps));
    if (uniqueGaps.length > 0) {
      gapAnalysis.couldFix = uniqueGaps;
    }
  }

  // Score Breakdown from Minor Deductions
  const scoreBreakdown: string[] = [];
  if (deductions.length > 0) {
    scoreBreakdown.push(`Base Score: 10.0`);
    deductions.forEach(d => scoreBreakdown.push(d));
    scoreBreakdown.push(`Final Score: ${score.toFixed(1)}`);
  }

  // Score potential
  const potentialMatch = evaluation.match(/ASSESSMENT:\s*([^\n]+)/i);
  const scorePotential = potentialMatch ? potentialMatch[1].trim() : '';

  return {
    score,
    maxScore,
    summary,
    complianceChecks,
    evidenceQuality,
    evidenceCitations,
    evidenceVerification: evidenceCitations.map(c => `${c.client}: ${c.claim}`),
    governanceChecks,
    bannedWords,
    unverifiableClaims,
    evidenceGaps,
    actionableImprovements,
    gapAnalysis,
    topImprovements: actionableImprovements.length > 0 
      ? actionableImprovements.map(a => a.action)
      : [...gapAnalysis.shouldFix, ...gapAnalysis.couldFix].slice(0, 5),
    scorePotential,
    scoreBreakdown,
  };
}

// Parse simple score from evaluation
export function parseScoreFromEvaluation(evaluation: string): number {
  const scoreMatch = evaluation.match(/Overall Score:\s*(\d+\.?\d*)\/(\d+)/i);
  return scoreMatch ? parseFloat(scoreMatch[1]) : 0;
}

// Keep the old parseEvaluation for backward compatibility
export function parseEvaluation(evaluation: string): { score: number; maxScore: number; summary: string; complianceChecks: string[]; evidenceQuality: string[] } {
  const full = parseFullEvaluation(evaluation);
  return {
    score: full.score,
    maxScore: full.maxScore,
    summary: full.summary,
    complianceChecks: full.complianceChecks,
    evidenceQuality: full.evidenceQuality,
  };
}

export function getScoreColor(score: number): string {
  if (score >= 8) return '#10b981';
  if (score >= 6) return '#f59e0b';
  return '#ef4444';
}

export function getScoreLabel(score: number): string {
  if (score >= 9) return 'Excellent';
  if (score >= 8) return 'Strong';
  if (score >= 7) return 'Good';
  if (score >= 6) return 'Adequate';
  if (score >= 5) return 'Needs Work';
  return 'Weak';
}
