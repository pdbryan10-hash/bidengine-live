import { NextRequest, NextResponse } from 'next/server';

const BUBBLE_API_URL = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';
const BUBBLE_API_KEY = process.env.BUBBLE_API_KEY || '33cb561a966f59ad7ea5e29a1906bf36';

const EVIDENCE_CATEGORIES = [
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    
    // Fetch all evidence in one call
    const constraints = JSON.stringify([
      { key: 'project_id', constraint_type: 'equals', value: clientId }
    ]);
    
    const response = await fetch(
      `${BUBBLE_API_URL}/Project_Evidence?constraints=${encodeURIComponent(constraints)}&limit=500`,
      {
        headers: {
          'Authorization': `Bearer ${BUBBLE_API_KEY}`,
        },
      }
    );

    const evidence: { category: string; count: number }[] = [];

    if (response.ok) {
      const data = await response.json();
      const records = data.response?.results || [];
      
      // Count by category
      EVIDENCE_CATEGORIES.forEach(cat => {
        const count = records.filter((r: any) => r.category === cat.category).length;
        if (count > 0) {
          evidence.push({ category: cat.label, count });
        }
      });
    }

    // Sort by count descending
    evidence.sort((a, b) => b.count - a.count);

    return NextResponse.json({ evidence });
  } catch (error) {
    console.error('Error fetching client evidence:', error);
    return NextResponse.json({ evidence: [] });
  }
}
