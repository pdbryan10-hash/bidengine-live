'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Download, FileText, CheckCircle, Clock, Edit3, 
  ChevronDown, ChevronRight, Search, Filter, RefreshCw, Save,
  AlertCircle, TrendingUp, X, BarChart3, AlertTriangle, Shield, PenTool, Info, ExternalLink
} from 'lucide-react';
import Image from 'next/image';
import { UserButton } from '@clerk/nextjs';
import { fetchTenders, fetchQuestions, updateQuestion, parseFullEvaluation, extractCitationsFromAnswer, formatAnswerWithReferences, getScoreLabel, getScoreColor, fetchEvidenceById } from '@/lib/bubble';
import { TenderQuestion, Tender } from '@/types';
import { ExportModal } from '@/components/ExportModal';
import ClientBadge from '@/components/ClientBadge';

const BUBBLE_API_KEY = '33cb561a966f59ad7ea5e29a1906bf36';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';

interface TenderWithStats extends Tender {
  totalQuestions: number;
  draftCount: number;
  reviewCount: number;
  finalCount: number;
  avgScore: number;
}

// Count sub-questions in a question text
function countSubQuestions(questionText: string): number {
  if (!questionText) return 1;
  
  let count = 0;
  
  // Count lettered sub-questions: a), b), c) or (a), (b), (c) or a. b. c.
  const letteredMatch = questionText.match(/(?:^|\n|\s)(?:\()?[a-z](?:\)|\.|:)/gi);
  if (letteredMatch) count += letteredMatch.length;
  
  // Count numbered sub-questions: 1), 2), 3) or (1), (2) or 1. 2. 3. (but not dates or references)
  const numberedMatch = questionText.match(/(?:^|\n|\s)(?:\()?\d{1,2}(?:\)|\.)(?:\s)/g);
  if (numberedMatch) count += numberedMatch.length;
  
  // Count bullet-style indicators: •, -, * at start of lines
  const bulletMatch = questionText.match(/(?:^|\n)\s*[•\-\*]\s+/g);
  if (bulletMatch) count += bulletMatch.length;
  
  // Count "and" separated requirements in the question
  const andParts = questionText.split(/\band\b/gi).length - 1;
  if (andParts > 0 && count === 0) count += andParts;
  
  // Minimum 1 sub-question (the main question itself)
  return Math.max(1, count);
}

// Aggregate evaluation data across all questions
function aggregateEvaluations(questions: TenderQuestion[]) {
  const allEvals = questions.map(q => parseFullEvaluation(q.final_evaluation || ''));
  
  // Count total sub-questions
  const totalSubQuestions = questions.reduce((sum, q) => sum + countSubQuestions(q.question_text), 0);
  
  // Score distribution
  const scoreDistribution = { excellent: 0, good: 0, needsWork: 0, unscored: 0 };
  const scoredQuestions = allEvals.filter(e => e.score > 0);
  scoredQuestions.forEach(e => {
    if (e.score >= 8) scoreDistribution.excellent++;
    else if (e.score >= 6) scoreDistribution.good++;
    else scoreDistribution.needsWork++;
  });
  scoreDistribution.unscored = questions.length - scoredQuestions.length;

  // Generate summary from individual evaluations
  const summaries = allEvals.map(e => e.summary).filter(s => s && s.length > 0);
  const avgScore = scoredQuestions.length > 0 
    ? scoredQuestions.reduce((sum, e) => sum + e.score, 0) / scoredQuestions.length 
    : 0;
  
  // Build overall summary - 2 paragraphs
  let summary = '';
  if (scoredQuestions.length > 0) {
    const scoreDesc = avgScore >= 8.5 ? 'Excellent' : avgScore >= 8 ? 'Strong' : avgScore >= 7 ? 'Good' : 'Needs improvement';
    
    // Paragraph 1: Overall performance
    summary = `${scoreDesc} tender submission achieving an average score of ${avgScore.toFixed(1)}/10 across ${questions.length} questions. `;
    summary += `${scoreDistribution.excellent} responses scored excellent (8+), ${scoreDistribution.good} scored good (6-7.9)`;
    if (scoreDistribution.needsWork > 0) {
      summary += `, and ${scoreDistribution.needsWork} need${scoreDistribution.needsWork === 1 ? 's' : ''} further work`;
    }
    summary += '. ';
    
    // Paragraph 2: Key insights from evaluations
    if (summaries.length > 0) {
      // Collect unique insights from top evaluations
      const insights: string[] = [];
      summaries.slice(0, 5).forEach(s => {
        const sentences = s.split(/[.!]/).filter(sent => sent.trim().length > 15);
        sentences.forEach(sent => {
          const trimmed = sent.trim();
          if (trimmed.length > 20 && trimmed.length < 300 && !insights.some(i => i.toLowerCase().includes(trimmed.toLowerCase().slice(0, 30)))) {
            insights.push(trimmed);
          }
        });
      });
      
      if (insights.length > 0) {
        summary += '\n\n';
        summary += insights.slice(0, 3).join('. ');
        if (!summary.endsWith('.')) summary += '.';
      }
    }
  }

  // Aggregate gaps (deduplicate and count occurrences)
  const gapCounts = new Map<string, { count: number; type: 'must' | 'should' | 'could' }>();
  allEvals.forEach(e => {
    e.gapAnalysis.mustFix.forEach(gap => {
      const key = gap.toLowerCase().trim();
      const existing = gapCounts.get(key);
      if (existing) existing.count++;
      else gapCounts.set(key, { count: 1, type: 'must' });
    });
    e.gapAnalysis.shouldFix.forEach(gap => {
      const key = gap.toLowerCase().trim();
      if (!gapCounts.has(key)) gapCounts.set(key, { count: 1, type: 'should' });
      else {
        const existing = gapCounts.get(key)!;
        if (existing.type !== 'must') existing.count++;
      }
    });
    e.gapAnalysis.couldFix.forEach(gap => {
      const key = gap.toLowerCase().trim();
      if (!gapCounts.has(key)) gapCounts.set(key, { count: 1, type: 'could' });
      else {
        const existing = gapCounts.get(key)!;
        if (existing.type === 'could') existing.count++;
      }
    });
  });

  // Sort by count and group by type
  const sortedGaps = Array.from(gapCounts.entries())
    .sort((a, b) => b[1].count - a[1].count);
  
  const aggregatedGaps = {
    mustFix: sortedGaps.filter(([_, v]) => v.type === 'must').slice(0, 5).map(([k, v]) => ({ text: k, count: v.count })),
    shouldFix: sortedGaps.filter(([_, v]) => v.type === 'should').slice(0, 5).map(([k, v]) => ({ text: k, count: v.count })),
    couldFix: sortedGaps.filter(([_, v]) => v.type === 'could').slice(0, 5).map(([k, v]) => ({ text: k, count: v.count })),
  };

  // Aggregate evidence issues
  const evidenceIssues = new Map<string, number>();
  allEvals.forEach(e => {
    e.evidenceGaps.forEach(gap => {
      const key = gap.toLowerCase().trim();
      evidenceIssues.set(key, (evidenceIssues.get(key) || 0) + 1);
    });
  });
  const topEvidenceIssues = Array.from(evidenceIssues.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));

  // Aggregate improvements
  const improvements = new Map<string, number>();
  allEvals.forEach(e => {
    e.topImprovements.forEach(imp => {
      const key = imp.toLowerCase().trim();
      improvements.set(key, (improvements.get(key) || 0) + 1);
    });
  });
  const topImprovements = Array.from(improvements.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));

  return {
    scoreDistribution,
    avgScore,
    summary,
    aggregatedGaps,
    topEvidenceIssues,
    topImprovements,
    scoredCount: scoredQuestions.length,
    totalQuestions: questions.length,
    totalSubQuestions,
  };
}

// Tender Overview Component
function TenderOverview({ questions, tender }: { questions: TenderQuestion[]; tender?: TenderWithStats }) {
  const [expanded, setExpanded] = useState(true);
  const agg = aggregateEvaluations(questions);
  
  if (questions.length === 0) return null;

  const totalGaps = agg.aggregatedGaps.mustFix.length + agg.aggregatedGaps.shouldFix.length + agg.aggregatedGaps.couldFix.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 bg-gradient-to-br from-[#12121a] to-[#0a0a12] rounded-xl border border-white/10 overflow-hidden"
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <BarChart3 size={20} className="text-cyan-400" />
          </div>
          <div className="text-left">
            <h3 className="text-white font-semibold">Tender Overview</h3>
            <p className="text-gray-500 text-sm">
              {agg.totalQuestions} questions · {agg.totalSubQuestions} sub-parts · Avg {agg.avgScore > 0 ? agg.avgScore.toFixed(1) : '-'}/10
              {tender?.processing_time && (
                <span className="ml-2 text-cyan-400">
                  ⚡ {Math.floor(tender.processing_time / 60)}:{(tender.processing_time % 60).toString().padStart(2, '0')} total
                  <span className="text-gray-500 ml-1">
                    ({Math.round(tender.processing_time / agg.totalQuestions)}s per question)
                  </span>
                </span>
              )}
              <span 
                className="inline ml-1 cursor-help" 
                title="Scored against buyer criteria: compliance, evidence strength, specificity, structure, and governance"
              >
                <Info size={12} className="inline text-gray-600" />
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Quick stats badges */}
          {agg.aggregatedGaps.mustFix.length > 0 && (
            <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
              {agg.aggregatedGaps.mustFix.length} critical gaps
            </span>
          )}
          <ChevronDown 
            size={20} 
            className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} 
          />
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-white/5">
              {/* Summary Section */}
              <div className="bg-white/5 rounded-lg p-4 mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Evaluation Summary</p>
                <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                  {agg.summary || 'Strong responses with verified evidence across all questions. Review gap analysis for specific improvement opportunities.'}
                </div>
              </div>

              {/* Three Column Grid */}
              <div className="grid grid-cols-3 gap-4">
                {/* Score Distribution */}
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Score Distribution</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 text-sm">Excellent (8+)</span>
                      <span className="text-white font-bold">{agg.scoreDistribution.excellent}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 text-sm">Good (6-7.9)</span>
                      <span className="text-white font-bold">{agg.scoreDistribution.good}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-red-400 text-sm">Needs Work (&lt;6)</span>
                      <span className="text-white font-bold">{agg.scoreDistribution.needsWork}</span>
                    </div>
                    {agg.scoreDistribution.unscored > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-sm">Unscored</span>
                        <span className="text-gray-400 font-bold">{agg.scoreDistribution.unscored}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Gap Analysis */}
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Gap Analysis</p>
                    <div className="flex items-center gap-3 text-[10px]">
                      <span className="flex items-center gap-1"><span className="text-red-400">●</span> Must Fix</span>
                      <span className="flex items-center gap-1"><span className="text-amber-400">●</span> Should Fix</span>
                      <span className="flex items-center gap-1"><span className="text-emerald-400">●</span> Could Fix</span>
                    </div>
                  </div>
                  {totalGaps > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {agg.aggregatedGaps.mustFix.map((gap, i) => (
                        <div key={`must-${i}`} className="flex items-start gap-2">
                          <span className="text-red-400 text-xs mt-0.5">●</span>
                          <span className="text-gray-300 text-xs">{gap.text}</span>
                          {gap.count > 1 && <span className="text-gray-600 text-xs">×{gap.count}</span>}
                        </div>
                      ))}
                      {agg.aggregatedGaps.shouldFix.map((gap, i) => (
                        <div key={`should-${i}`} className="flex items-start gap-2">
                          <span className="text-amber-400 text-xs mt-0.5">●</span>
                          <span className="text-gray-300 text-xs">{gap.text}</span>
                          {gap.count > 1 && <span className="text-gray-600 text-xs">×{gap.count}</span>}
                        </div>
                      ))}
                      {agg.aggregatedGaps.couldFix.map((gap, i) => (
                        <div key={`could-${i}`} className="flex items-start gap-2">
                          <span className="text-emerald-400 text-xs mt-0.5">●</span>
                          <span className="text-gray-300 text-xs">{gap.text}</span>
                          {gap.count > 1 && <span className="text-gray-600 text-xs">×{gap.count}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 text-sm">No gaps identified</p>
                  )}
                </div>

                {/* Top Improvements */}
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Top Improvements</p>
                  {agg.topImprovements.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {agg.topImprovements.map((imp, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <TrendingUp size={12} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-300 text-xs">{imp.text}</span>
                          {imp.count > 1 && <span className="text-gray-600 text-xs">×{imp.count}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-600 text-sm">No improvements suggested</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function parseScoreFromEvaluation(evaluation: string): number {
  if (!evaluation) return 0;
  const scoreMatch = evaluation.match(/Overall Score:\s*(\d+\.?\d*)\/(\d+)/i);
  return scoreMatch ? parseFloat(scoreMatch[1]) : 0;
}

async function fetchTenderStats(tenderId: string): Promise<{ total: number; draft: number; review: number; final: number; avgScore: number }> {
  try {
    const constraints = JSON.stringify([
      { key: 'tender', constraint_type: 'equals', value: tenderId }
    ]);
    const response = await fetch(
      `${BUBBLE_API_BASE}/tender_questions?constraints=${encodeURIComponent(constraints)}&limit=100`,
      { headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` } }
    );
    if (!response.ok) return { total: 0, draft: 0, review: 0, final: 0, avgScore: 0 };
    
    const data = await response.json();
    const questions = data.response.results || [];
    
    let draft = 0, review = 0, final = 0, totalScore = 0, scoredCount = 0;
    
    questions.forEach((q: any) => {
      const status = (q.status || '').toLowerCase().trim();
      if (status === 'in review' || status === 'review' || status === 'in_review') {
        review++;
      } else if (status === 'final' || status === 'complete' || status === 'completed') {
        final++;
      } else {
        draft++;
      }
      
      const score = parseScoreFromEvaluation(q.final_evaluation || '');
      if (score > 0) {
        totalScore += score;
        scoredCount++;
      }
    });
    
    const total = (data.response.remaining || 0) + (data.response.count || 0);
    const avgScore = scoredCount > 0 ? totalScore / scoredCount : 0;
    
    return { total, draft, review, final, avgScore };
  } catch (error) {
    console.error('Failed to fetch tender stats:', error);
    return { total: 0, draft: 0, review: 0, final: 0, avgScore: 0 };
  }
}

function getTileScoreColor(score: number): string {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-amber-400';
  if (score > 0) return 'text-red-400';
  return 'text-gray-500';
}

function getTileScoreGradient(score: number): string {
  if (score >= 8) return 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30';
  if (score >= 6) return 'from-amber-500/20 to-amber-600/10 border-amber-500/30';
  if (score > 0) return 'from-red-500/20 to-red-600/10 border-red-500/30';
  return 'from-gray-500/20 to-gray-600/10 border-gray-500/30';
}

// Question Viewer Modal Component
function QuestionViewer({ question, onClose, onStatusChange, clientId }: { question: TenderQuestion; onClose: () => void; onStatusChange?: (questionId: string, status: string) => void; clientId: string }) {
  const eval_ = parseFullEvaluation(question.final_evaluation || '');
  const [activeTab, setActiveTab] = useState<'analysis' | 'gaps' | 'evidence'>('analysis');
  const [currentStatus, setCurrentStatus] = useState(question.status || 'Draft');
  const [saving, setSaving] = useState(false);
  const [evidencePopup, setEvidencePopup] = useState<{ id: string; data: any; loading: boolean } | null>(null);
  const wordCount = (question.answer_text || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;

  // Fetch and show evidence in popup
  const showEvidence = async (evidenceId: string) => {
    setEvidencePopup({ id: evidenceId, data: null, loading: true });
    const data = await fetchEvidenceById(evidenceId);
    setEvidencePopup({ id: evidenceId, data, loading: false });
  };

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    setCurrentStatus(newStatus);
    if (onStatusChange) {
      await onStatusChange(question._id, newStatus);
    }
    setSaving(false);
  };

  const getStatusButtonStyle = (status: string) => {
    const isActive = currentStatus.toLowerCase() === status.toLowerCase();
    if (status === 'Draft') {
      return isActive ? 'bg-amber-500 text-white' : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30';
    } else if (status === 'In Review') {
      return isActive ? 'bg-blue-500 text-white' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30';
    } else {
      return isActive ? 'bg-emerald-500 text-white' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" 
      onClick={onClose}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }} 
        onClick={(e) => e.stopPropagation()} 
        className="w-full max-w-6xl max-h-[90vh] overflow-hidden bg-[#0d0d15] rounded-2xl border border-white/10"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#12121a]">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg font-bold">{question.question_number}</span>
            <span className="text-gray-400 text-sm">{question.section}</span>
            {/* Processing info */}
            {(question.processed_at || question['Modified Date']) && (
              <div className="flex items-center gap-2 text-xs text-gray-500 ml-2">
                <span className="w-px h-4 bg-white/10" />
                <span title="Last processed">
                  {question.processed_at 
                    ? new Date(question.processed_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : question['Modified Date'] 
                      ? new Date(question['Modified Date']).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : ''
                  }
                </span>
                {question.n8n_execution_id && (
                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[10px] font-mono" title="n8n execution ID">
                    {question.n8n_execution_id.slice(-8)}
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Status Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs mr-2">Status:</span>
            {['Draft', 'In Review', 'Final'].map(status => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={saving}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${getStatusButtonStyle(status)} ${saving ? 'opacity-50' : ''}`}
              >
                {status}
              </button>
            ))}
            <div className="w-px h-6 bg-white/10 mx-2" />
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Modal Content - Split View */}
        <div className="flex h-[calc(90vh-130px)]">
          {/* Left - Question & Response */}
          <div className="flex-1 p-5 overflow-y-auto border-r border-white/10">
            {/* Question */}
            <div className="mb-5 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-medium mb-2">
                <FileText size={12} />
                QUESTION
              </div>
              <p className="text-gray-200 leading-relaxed">{question.question_text}</p>
            </div>

            {/* Response */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400 font-medium">Response</label>
                <span className="text-xs text-gray-500">{wordCount} words</span>
              </div>
              {question.answer_text ? (
                (() => {
                  const { cleanText, references } = formatAnswerWithReferences(question.answer_text);
                  return (
                    <div className="space-y-3">
                      {/* Main response text */}
                      <div 
                        className="p-4 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-sm leading-relaxed max-h-[350px] overflow-y-auto prose prose-invert prose-sm max-w-none [&_.citation-ref]:text-cyan-400 [&_.citation-ref]:font-medium [&_.citation-ref]:cursor-pointer [&_.citation-ref]:hover:text-cyan-300 [&_.citation-ref]:hover:underline" 
                        dangerouslySetInnerHTML={{ __html: cleanText }}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.classList.contains('citation-ref')) {
                            const evidenceId = target.getAttribute('data-evidence-id');
                            if (evidenceId) {
                              showEvidence(evidenceId);
                            }
                          }
                        }}
                      />
                      
                      {/* References section */}
                      {references.length > 0 && (
                        <div className="p-4 bg-[#080810] border border-white/10 rounded-xl">
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                            <FileText size={14} className="text-gray-500" />
                            <span className="text-xs text-gray-500 uppercase tracking-wider font-medium">References</span>
                          </div>
                          <div className="space-y-2">
                            {references.map((ref) => (
                              <button 
                                key={ref.number} 
                                onClick={() => showEvidence(ref.evidenceId)}
                                className="flex items-start gap-3 text-sm group hover:bg-white/5 p-1.5 -mx-1.5 rounded transition-colors w-full text-left"
                              >
                                <span className="text-cyan-400 font-medium w-5 flex-shrink-0 group-hover:text-cyan-300">{ref.number}</span>
                                <div className="flex-1">
                                  <span className="text-gray-300 group-hover:text-white">{ref.title}</span>
                                </div>
                                <ChevronRight size={14} className="text-gray-600 group-hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="p-8 bg-white/5 border border-white/10 rounded-xl text-center">
                  <FileText className="mx-auto text-gray-600 mb-3" size={32} />
                  <p className="text-gray-500">No response generated yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Right - Analysis Panel */}
          <div className="w-[420px] flex flex-col bg-[#0a0a12]">
            {/* Score Header */}
            <div className="p-5 border-b border-white/10 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Score</p>
              <div className="flex items-center justify-center gap-2">
                <span 
                  className="text-5xl font-bold" 
                  style={{ color: eval_.score > 0 ? getScoreColor(eval_.score) : '#6b7280' }}
                >
                  {eval_.score > 0 ? eval_.score.toFixed(1) : '-'}
                </span>
                <span className="text-gray-500 text-2xl">/10</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                {eval_.score > 0 ? getScoreLabel(eval_.score) : 'Not scored'}
              </p>
              
              {/* Potential score indicator */}
              {eval_.score > 0 && eval_.score < 9.5 && (
                <div className="mt-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <p className="text-xs text-emerald-400">
                    <TrendingUp size={12} className="inline mr-1" />
                    Current: {eval_.score.toFixed(1)}/10 - If evidence gaps filled in BidVault: {Math.min(eval_.score + 1.5, 10).toFixed(1)}/10
                  </p>
                </div>
              )}
            </div>

            {/* Summary */}
            {eval_.summary && (
              <div className="p-4 border-b border-white/10">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Summary</p>
                <p className="text-sm text-gray-400 italic">{eval_.summary}</p>
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-white/10">
              {[
                { id: 'analysis', label: 'Analysis', icon: BarChart3 },
                { id: 'gaps', label: 'Gaps', icon: AlertTriangle },
                { id: 'evidence', label: 'Evidence', icon: Shield },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === tab.id 
                      ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Analysis Tab */}
              {activeTab === 'analysis' && (
                <div className="space-y-4">
                  {/* Score Potential Banner */}
                  {eval_.scorePotential && (
                    <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-lg p-3">
                      <p className="text-sm text-cyan-400 font-medium">{eval_.scorePotential}</p>
                    </div>
                  )}

                  {/* Actionable Improvements */}
                  {eval_.actionableImprovements && eval_.actionableImprovements.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Actionable Improvements</p>
                      <div className="space-y-2">
                        {eval_.actionableImprovements.map((item, i) => (
                          <div key={i} className="bg-white/5 rounded-lg border border-white/10 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-white">{item.action}</p>
                                <p className="text-xs text-gray-400 mt-1">{item.how}</p>
                              </div>
                              <div className="flex-shrink-0 bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-xs font-bold">
                                {item.impact}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Score Breakdown */}
                  {eval_.scoreBreakdown.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Score Breakdown</p>
                      <div className="bg-white/5 rounded-lg p-3 space-y-1">
                        {eval_.scoreBreakdown.map((item, i) => {
                          const isDeduction = item.includes('-') && !item.includes('Base');
                          const isFinal = item.toLowerCase().includes('final');
                          return (
                            <div key={i} className={`flex justify-between text-xs ${isFinal ? 'border-t border-white/10 pt-2 mt-2 font-bold' : ''}`}>
                              <span className="text-gray-400">{item.split(':')[0]}</span>
                              <span className={isDeduction ? 'text-red-400' : isFinal ? 'text-cyan-400' : 'text-gray-300'}>
                                {item.split(':')[1] || ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Compliance Check */}
                  {eval_.complianceChecks.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Compliance Check</p>
                      <ul className="space-y-1.5">
                        {eval_.complianceChecks.map((item, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                            {item.includes('✓') || item.includes('✗') ? (
                              item.includes('✓') ? (
                                <CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                              ) : (
                                <X size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                              )
                            ) : (
                              <CheckCircle size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                            )}
                            <span>{item.replace(/[✓✗]\s*/g, '')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Banned Words */}
                  {eval_.bannedWords.length > 0 && eval_.bannedWords[0] !== 'none' && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Banned Words Found</p>
                      <div className="flex flex-wrap gap-2">
                        {eval_.bannedWords.filter(w => w && !w.includes('Total') && !w.includes('Deduction')).map((word, i) => (
                          <span key={i} className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-xs">
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No analysis fallback - show summary if available */}
                  {eval_.actionableImprovements.length === 0 && eval_.complianceChecks.length === 0 && eval_.scoreBreakdown.length === 0 && (
                    eval_.summary ? (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Evaluation Summary</p>
                        <div className="bg-white/5 rounded-lg border border-white/10 p-4">
                          <p className="text-sm text-gray-300 leading-relaxed">{eval_.summary}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No analysis available</p>
                    )
                  )}
                </div>
              )}

              {/* Gaps Tab */}
              {activeTab === 'gaps' && (
                <div className="space-y-3">
                  {eval_.gapAnalysis.mustFix.length > 0 && (
                    <div className="bg-red-500/10 border-l-4 border-red-500 p-3 rounded-r">
                      <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2">MUST FIX</p>
                      <ul className="space-y-1.5">
                        {eval_.gapAnalysis.mustFix.map((item, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-red-400 mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {eval_.gapAnalysis.shouldFix.length > 0 && (
                    <div className="bg-amber-500/10 border-l-4 border-amber-500 p-3 rounded-r">
                      <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">SHOULD FIX</p>
                      <ul className="space-y-1.5">
                        {eval_.gapAnalysis.shouldFix.map((item, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-amber-400 mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {eval_.gapAnalysis.couldFix.length > 0 && (
                    <div className="bg-emerald-500/10 border-l-4 border-emerald-500 p-3 rounded-r">
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">COULD FIX</p>
                      <ul className="space-y-1.5">
                        {eval_.gapAnalysis.couldFix.map((item, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {eval_.gapAnalysis.mustFix.length === 0 && 
                   eval_.gapAnalysis.shouldFix.length === 0 && 
                   eval_.gapAnalysis.couldFix.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No gaps identified</p>
                  )}
                </div>
              )}

              {/* Evidence Tab */}
              {activeTab === 'evidence' && (
                <div className="space-y-4">
                  {/* Citations Used */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Citations Used</p>
                    {(() => {
                      const citations = extractCitationsFromAnswer(question.answer_text || '');
                      return citations.length > 0 ? (
                        <div className="space-y-2">
                          {citations.map((cit, i) => (
                            <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/10">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-cyan-400">{cit.client}</p>
                                  <p className="text-xs text-gray-500 font-mono mt-1">{cit.evidenceId}</p>
                                </div>
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No citations found in response</p>
                      );
                    })()}
                  </div>

                  {/* Evidence Gaps */}
                  {eval_.evidenceGaps.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Evidence Gaps Identified</p>
                      <div className="space-y-2">
                        {eval_.evidenceGaps.map((gap, i) => (
                          <div key={i} className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                              <p className="text-sm text-gray-300">{gap}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verification Status */}
                  {eval_.evidenceVerification.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Verification Status</p>
                      <div className="space-y-2">
                        {eval_.evidenceVerification.map((item, i) => (
                          <div key={i} className="p-2 bg-white/5 rounded text-xs text-gray-400 font-mono">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show message if nothing */}
                  {(() => {
                    const citations = extractCitationsFromAnswer(question.answer_text || '');
                    if (citations.length === 0 && eval_.evidenceGaps.length === 0) {
                      return <p className="text-gray-500 text-center py-4">No evidence information available</p>;
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Evidence Popup Modal */}
      <AnimatePresence>
        {evidencePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setEvidencePopup(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[80vh] overflow-hidden bg-[#0d0d15] rounded-2xl border border-cyan-500/30 shadow-2xl shadow-cyan-500/10"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-purple-500/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <FileText size={18} className="text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Evidence Record</h3>
                    <div className="flex items-center gap-2">
                      {evidencePopup.data?.category && (
                        <span className="text-xs text-gray-400">{evidencePopup.data.category}</span>
                      )}
                      {evidencePopup.data?.category && evidencePopup.id && (
                        <span className="text-xs text-gray-600">•</span>
                      )}
                      {evidencePopup.id && (
                        <span className="text-xs text-gray-500 font-mono">#{evidencePopup.id.slice(-8)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => setEvidencePopup(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                {evidencePopup.loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="animate-spin text-cyan-400" size={32} />
                  </div>
                ) : evidencePopup.data ? (
                  <div className="space-y-4">
                    {/* Title */}
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider">Title</label>
                      <h4 className="text-lg text-white font-medium mt-1">{evidencePopup.data.title || evidencePopup.data.Title || 'Untitled'}</h4>
                    </div>

                    {/* Source Text - try multiple field names */}
                    {(evidencePopup.data.source_text || evidencePopup.data['Source Text'] || evidencePopup.data.Source_Text || evidencePopup.data.text || evidencePopup.data.content) && (
                      <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wider">Source Text</label>
                        <div className="mt-2 p-4 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-sm leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                          {evidencePopup.data.source_text || evidencePopup.data['Source Text'] || evidencePopup.data.Source_Text || evidencePopup.data.text || evidencePopup.data.content}
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-4 pt-4 border-t border-white/10">
                      {evidencePopup.id && (
                        <div>
                          <label className="text-xs text-gray-500">Record ID</label>
                          <p className="text-sm text-gray-300 font-mono">{evidencePopup.id}</p>
                        </div>
                      )}
                      {evidencePopup.data.category && (
                        <div>
                          <label className="text-xs text-gray-500">Category</label>
                          <p className="text-sm text-cyan-400">{evidencePopup.data.category}</p>
                        </div>
                      )}
                      {evidencePopup.data.client_name && (
                        <div>
                          <label className="text-xs text-gray-500">Client</label>
                          <p className="text-sm text-gray-300">{evidencePopup.data.client_name}</p>
                        </div>
                      )}
                      {evidencePopup.data['Modified Date'] && (
                        <div>
                          <label className="text-xs text-gray-500">Last Updated</label>
                          <p className="text-sm text-gray-300">{new Date(evidencePopup.data['Modified Date']).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>

                    {/* View in BidVault link */}
                    {evidencePopup.data.category && (
                      <div className="pt-3">
                        <a 
                          href={`/v/${clientId}/bidvault/${encodeURIComponent(evidencePopup.data.category)}?record=${evidencePopup.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setEvidencePopup(null); }}
                        >
                          <ExternalLink size={14} />
                          View in BidVault → {evidencePopup.data.category}
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle className="mx-auto text-red-400 mb-3" size={32} />
                    <p className="text-gray-400">Evidence record not found</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function BidWritePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const tenderId = searchParams.get('tender');

  const [tenders, setTenders] = useState<TenderWithStats[]>([]);
  const [selectedTender, setSelectedTender] = useState<TenderWithStats | null>(null);
  const [questions, setQuestions] = useState<TenderQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showTenderDropdown, setShowTenderDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedQuestion, setSelectedQuestion] = useState<TenderQuestion | null>(null);

  // Load tenders with stats
  useEffect(() => {
    async function loadTenders() {
      setLoading(true);
      const tendersData = await fetchTenders(clientId);
      
      const tendersWithStats: TenderWithStats[] = await Promise.all(
        tendersData.slice(0, 9).map(async (tender) => {
          const stats = await fetchTenderStats(tender._id);
          return {
            ...tender,
            totalQuestions: stats.total,
            draftCount: stats.draft,
            reviewCount: stats.review,
            finalCount: stats.final,
            avgScore: stats.avgScore
          };
        })
      );
      
      setTenders(tendersWithStats);
      
      // If tender specified in URL, select it
      if (tenderId) {
        const found = tendersWithStats.find(t => t._id === tenderId);
        if (found) setSelectedTender(found);
      }
      setLoading(false);
    }
    loadTenders();
  }, [clientId, tenderId]);

  // Load questions when tender changes
  useEffect(() => {
    async function loadQuestions() {
      if (!selectedTender) {
        setQuestions([]);
        return;
      }
      setLoadingQuestions(true);
      const data = await fetchQuestions(selectedTender._id, clientId);
      const sorted = [...data].sort((a, b) => {
        const aNum = a.question_number || '';
        const bNum = b.question_number || '';
        const aMatch = aNum.match(/^(\d+)(.*)$/);
        const bMatch = bNum.match(/^(\d+)(.*)$/);
        if (aMatch && bMatch) {
          const aNumeric = parseInt(aMatch[1], 10);
          const bNumeric = parseInt(bMatch[1], 10);
          if (aNumeric !== bNumeric) return aNumeric - bNumeric;
          return (aMatch[2] || '').localeCompare(bMatch[2] || '');
        }
        return aNum.localeCompare(bNum);
      });
      setQuestions(sorted);
      setLoadingQuestions(false);
    }
    loadQuestions();
  }, [selectedTender, clientId]);

  // Filter questions
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = searchQuery === '' || 
      (q.question_text || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.question_number || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
      (q.status || '').toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Stats for selected tender
  const stats = {
    total: questions.length,
    avgScore: (() => {
      const scored = questions.filter(q => parseFullEvaluation(q.final_evaluation || '').score > 0);
      if (scored.length === 0) return 0;
      return scored.reduce((sum, q) => sum + parseFullEvaluation(q.final_evaluation || '').score, 0) / scored.length;
    })()
  };

  const handleSelectTender = (tender: TenderWithStats) => {
    setSelectedTender(tender);
    router.push(`/v/${clientId}/bidwrite?tender=${tender._id}`);
  };

  const handleBackToTenders = () => {
    setSelectedTender(null);
    setQuestions([]);
    router.push(`/v/${clientId}/bidwrite`);
  };

  const handleRefresh = async () => {
    if (!selectedTender) return;
    setLoadingQuestions(true);
    const data = await fetchQuestions(selectedTender._id, clientId);
    setQuestions(data);
    setLoadingQuestions(false);
  };

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'final' || s === 'complete') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (s.includes('review')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  };

  // Normalize status for display
  const getStatusLabel = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'final' || s === 'complete' || s === 'completed') return 'Final';
    if (s.includes('review')) return 'In Review';
    if (s === 'pending' || s === 'draft' || !s) return 'Draft';
    return status; // Return original if unknown
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-full mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push(`/v/${clientId}`)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-400" />
              </button>
              <div className="flex items-center gap-3">
                <Image src="/bidwrite-logo.svg" alt="BidWrite" width={100} height={28} />
                <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 text-white rounded-md" style={{boxShadow: '0 0 12px rgba(6,182,212,0.4)'}}>BETA</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ClientBadge clientId={clientId} compact />
              <div className="h-5 w-px bg-white/10" />
              <a href="https://hello.bidengine.co" target="_blank" className="text-gray-400 hover:text-white transition-colors text-sm">About</a>
              <a href="https://docs.bidengine.co" target="_blank" className="text-gray-400 hover:text-white transition-colors text-sm">Help</a>
              <button
                onClick={() => router.push(`/v/${clientId}`)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 text-white text-sm rounded-lg hover:bg-white/10 transition-colors"
              >
                <ArrowLeft size={14} />
                Dashboard
              </button>
              {selectedTender && (
                <button
                  onClick={() => setShowExport(true)}
                  disabled={questions.length === 0}
                  className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Download size={16} />
                  Export
                </button>
              )}
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Show Tender Tiles if no tender selected */}
        {!selectedTender ? (
          <>
            {/* Page Header with BidWrite logo and Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Image src="/bidwrite-logo.svg" alt="BidWrite" width={120} height={40} />
                  <div className="h-8 w-px bg-white/10" />
                  <div>
                    <h1 className="text-xl font-bold text-white">Select a Tender</h1>
                    <p className="text-gray-500 text-sm">Choose a tender to view and manage responses</p>
                  </div>
                </div>
                
                {/* Tender Dropdown */}
                {tenders.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowTenderDropdown(!showTenderDropdown)}
                      className="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors min-w-[280px]"
                    >
                      <FileText size={18} className="text-cyan-400" />
                      <span className="text-gray-400 truncate flex-1 text-left">
                        Jump to tender...
                      </span>
                      <ChevronDown size={18} className={`text-gray-400 transition-transform ${showTenderDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {showTenderDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute top-full right-0 mt-2 bg-[#12121a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[300px] overflow-y-auto min-w-[280px]"
                        >
                          {tenders.map(tender => (
                            <button
                              key={tender._id}
                              onClick={() => {
                                handleSelectTender(tender);
                                setShowTenderDropdown(false);
                              }}
                              className="w-full px-4 py-3 text-left hover:bg-white/5 transition-colors flex items-center justify-between"
                            >
                              <span className="truncate text-white">{tender.tender_name}</span>
                              <span className={`text-sm font-bold ${getTileScoreColor(tender.avgScore)}`}>
                                {tender.avgScore > 0 ? tender.avgScore.toFixed(1) : '-'}
                              </span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Tender Tiles Grid */}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 animate-pulse">
                    <div className="h-6 bg-white/10 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-white/10 rounded w-1/2 mb-6"></div>
                    <div className="flex gap-4">
                      <div className="h-8 bg-white/10 rounded w-16"></div>
                      <div className="h-8 bg-white/10 rounded w-16"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : tenders.length === 0 ? (
              <div className="bg-white/5 border border-white/10 border-dashed rounded-xl p-12 text-center">
                <FileText className="mx-auto text-gray-500 mb-4" size={48} />
                <h3 className="text-white font-medium mb-2">No tenders yet</h3>
                <p className="text-gray-500 text-sm mb-6">Upload a tender document to get started</p>
                <button
                  onClick={() => router.push(`/v/${clientId}/upload/bidwrite`)}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
                >
                  Upload Tender
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Start New Tender Button - First Tile */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => router.push(`/v/${clientId}/upload/bidwrite`)}
                  className="relative group cursor-pointer"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 rounded-xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <div className="relative bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-2 border-dashed border-cyan-500/40 group-hover:border-cyan-400 rounded-xl p-5 h-full min-h-[180px] flex flex-col items-center justify-center transition-all duration-300 group-hover:translate-y-[-2px]">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <PenTool className="text-white" size={28} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                      Start New Tender
                    </h3>
                    <p className="text-gray-400 text-sm text-center">
                      Upload ITT documents to begin
                    </p>
                  </div>
                </motion.div>

                {/* Existing Tender Tiles */}
                {tenders.map((tender, index) => (
                  <motion.div
                    key={tender._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                    onClick={() => handleSelectTender(tender)}
                    className="relative group cursor-pointer"
                  >
                    {/* Glow effect on hover */}
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/10 group-hover:border-blue-500/40 rounded-xl p-5 transition-all duration-300 group-hover:translate-y-[-2px]">
                      {/* Tender Name */}
                      <h3 className="text-white font-semibold mb-1 truncate group-hover:text-blue-400 transition-colors">
                        {tender.tender_name}
                      </h3>
                      
                      {/* Date */}
                      <p className="text-gray-500 text-xs mb-4">
                        {tender.Created_Date 
                          ? new Date(tender.Created_Date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'No date'
                        }
                      </p>
                      
                      {/* Score Badge */}
                      <div className="flex items-center justify-between mb-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r border ${getTileScoreGradient(tender.avgScore)}`}>
                          <TrendingUp size={14} className={getTileScoreColor(tender.avgScore)} />
                          <span className={`font-bold ${getTileScoreColor(tender.avgScore)}`}>
                            {tender.avgScore > 0 ? tender.avgScore.toFixed(1) : '-'}/10
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-500 text-sm">
                            {tender.totalQuestions} questions
                          </span>
                          {tender.processing_time && (
                            <p className="text-xs text-gray-600">
                              ⚡ {Math.floor(tender.processing_time / 60)}:{(tender.processing_time % 60).toString().padStart(2, '0')}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Status Counts */}
                      <div className="flex gap-3 pt-3 border-t border-white/5">
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="w-2 h-2 rounded-full bg-amber-400" />
                          <span className="text-gray-400">{tender.draftCount}</span>
                          <span className="text-gray-600">Draft</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="w-2 h-2 rounded-full bg-blue-400" />
                          <span className="text-gray-400">{tender.reviewCount}</span>
                          <span className="text-gray-600">Review</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          <span className="text-gray-400">{tender.finalCount}</span>
                          <span className="text-gray-600">Final</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Selected Tender - Show Questions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              {/* Back button and tender info */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleBackToTenders}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <ArrowLeft size={20} className="text-gray-400" />
                  </button>
                  <div>
                    <h1 className="text-xl font-bold text-white">{selectedTender.tender_name}</h1>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{stats.total} Questions</span>
                      <span 
                        className={`font-bold ${stats.avgScore >= 8 ? 'text-emerald-400' : stats.avgScore >= 6 ? 'text-amber-400' : 'text-gray-400'} cursor-help`}
                        title="Scored against buyer criteria: compliance, evidence strength, specificity, structure, and governance"
                      >
                        Avg: {stats.avgScore > 0 ? stats.avgScore.toFixed(1) : '-'}/10
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Fix Critical Gaps Button */}
                  {(() => {
                    const lowestScoreQ = questions
                      .filter(q => parseFullEvaluation(q.final_evaluation || '').score > 0)
                      .sort((a, b) => parseFullEvaluation(a.final_evaluation || '').score - parseFullEvaluation(b.final_evaluation || '').score)[0];
                    return lowestScoreQ && parseFullEvaluation(lowestScoreQ.final_evaluation || '').score < 8 ? (
                      <button
                        onClick={() => setSelectedQuestion(lowestScoreQ)}
                        className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-lg border border-red-500/30 hover:bg-red-500/30 transition-all flex items-center gap-1.5"
                      >
                        <AlertTriangle size={12} />
                        Fix Lowest: {lowestScoreQ.question_number}
                      </button>
                    ) : null;
                  })()}
                  
                  {/* Status Filter Buttons */}
                  <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                    {[
                      { value: 'all', label: 'All' },
                      { value: 'draft', label: 'Draft' },
                      { value: 'review', label: 'Review' },
                      { value: 'final', label: 'Final' }
                    ].map(filter => (
                      <button
                        key={filter.value}
                        onClick={() => setStatusFilter(filter.value)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                          statusFilter === filter.value
                            ? 'bg-cyan-500 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                  
                  <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-cyan-500/50 w-48"
                    />
                  </div>
                  <button onClick={handleRefresh} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:border-white/20">
                    <RefreshCw size={16} className={`text-gray-400 ${loadingQuestions ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Tender Overview Panel */}
            {!loadingQuestions && questions.length > 0 && (
              <TenderOverview questions={questions} tender={selectedTender} />
            )}

            {/* Questions List */}
            {loadingQuestions ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw size={32} className="text-cyan-400 animate-spin" />
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-gray-500">No questions found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredQuestions.map((question) => {
                  const ev = parseFullEvaluation(question.final_evaluation || '');

                  return (
                    <motion.div
                      key={question._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => setSelectedQuestion(question)}
                      className="bg-white/[0.03] border border-white/10 rounded-xl p-4 hover:border-cyan-500/30 hover:bg-white/[0.05] transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        {/* Score Box */}
                        <div 
                          className="w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0"
                          style={{ 
                            background: ev.score > 0 ? `${getScoreColor(ev.score)}20` : 'rgba(255,255,255,0.05)',
                            color: ev.score > 0 ? getScoreColor(ev.score) : '#6b7280',
                            border: `1px solid ${ev.score > 0 ? getScoreColor(ev.score) + '40' : 'rgba(255,255,255,0.1)'}`
                          }}
                        >
                          {ev.score > 0 ? ev.score.toFixed(1) : '-'}
                        </div>
                        
                        {/* Question Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-cyan-400 text-sm font-bold">{question.question_number}</span>
                            <span className={`px-2 py-0.5 text-xs rounded border ${getStatusColor(question.status || '')}`}>
                              {getStatusLabel(question.status)}
                            </span>
                            {question.section && (
                              <span className="text-gray-600 text-xs">{question.section}</span>
                            )}
                            {/* Processing timestamp */}
                            {(question.processed_at || question['Modified Date']) && (
                              <span className="text-gray-600 text-xs ml-auto flex items-center gap-1">
                                <Clock size={10} />
                                {question.processed_at 
                                  ? new Date(question.processed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                  : question['Modified Date'] 
                                    ? new Date(question['Modified Date']).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                    : ''
                                }
                              </span>
                            )}
                          </div>
                          <p className="text-gray-300 text-sm">{question.question_text}</p>
                        </div>

                        {/* Arrow */}
                        <ChevronRight size={20} className="text-gray-600 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Question Viewer Modal */}
      <AnimatePresence>
        {selectedQuestion && (
          <QuestionViewer 
            question={selectedQuestion} 
            onClose={() => setSelectedQuestion(null)}
            clientId={clientId}
            onStatusChange={async (questionId, status) => {
              await updateQuestion(questionId, { status });
              // Update local state
              setQuestions(prev => prev.map(q => 
                q._id === questionId ? { ...q, status } : q
              ));
            }}
          />
        )}
      </AnimatePresence>

      {/* Export Modal */}
      {showExport && (
        <ExportModal
          questions={questions}
          tenderName={selectedTender?.tender_name}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
