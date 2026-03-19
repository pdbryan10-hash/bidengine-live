'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, FileText, CheckCircle, Clock, Edit3, 
  ChevronRight, TrendingUp, Database, PenTool, BarChart3
} from 'lucide-react';
import Image from 'next/image';
import { UserButton } from '@clerk/nextjs';
import { fetchTenders, fetchEvidenceCounts, EvidenceCounts } from '@/lib/bubble';

interface Tender {
  _id: string;
  tender_name: string;
  client?: string;
  status?: string;
  'Created Date'?: string;
  avg_score?: number;
  question_count?: number;
  draft_count?: number;
  review_count?: number;
  final_count?: number;
}

interface TenderWithStats extends Tender {
  totalQuestions: number;
  draftCount: number;
  reviewCount: number;
  finalCount: number;
  avgScore: number;
}

const BUBBLE_API_KEY = '33cb561a966f59ad7ea5e29a1906bf36';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';

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
      // Only count as review/final if explicitly set, everything else is draft
      if (status === 'in review' || status === 'review' || status === 'in_review') {
        review++;
      } else if (status === 'final' || status === 'complete' || status === 'completed') {
        final++;
      } else {
        // Default: draft (includes empty, 'draft', or any other value)
        draft++;
      }
      
      // Parse score from final_evaluation field (same as BidWrite)
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

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 6) return 'text-amber-400';
  if (score > 0) return 'text-red-400';
  return 'text-gray-500';
}

function getScoreGradient(score: number): string {
  if (score >= 8) return 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30';
  if (score >= 6) return 'from-amber-500/20 to-amber-600/10 border-amber-500/30';
  if (score > 0) return 'from-red-500/20 to-red-600/10 border-red-500/30';
  return 'from-gray-500/20 to-gray-600/10 border-gray-500/30';
}

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  
  const [tenders, setTenders] = useState<TenderWithStats[]>([]);
  const [evidenceCounts, setEvidenceCounts] = useState<EvidenceCounts>({});
  const [loading, setLoading] = useState(true);
  const [loadingEvidence, setLoadingEvidence] = useState(true);

  useEffect(() => {
    async function loadData() {
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
      setLoading(false);
    }
    
    async function loadEvidence() {
      setLoadingEvidence(true);
      const counts = await fetchEvidenceCounts(clientId);
      setEvidenceCounts(counts);
      setLoadingEvidence(false);
    }
    
    loadData();
    loadEvidence();
  }, [clientId]);

  const totalEvidence = Object.values(evidenceCounts).reduce((sum, t) => sum + t.count, 0);
  const categoriesWithData = Object.values(evidenceCounts).filter(t => t.count > 0).length;

  const navModules = [
    {
      name: 'BidVault',
      description: 'Evidence Library',
      logo: '/bidvault-logo.svg',
      href: `/v/${clientId}/bidvault`,
      color: 'from-purple-500/20 to-purple-600/10',
      borderColor: 'border-purple-500/30',
      hoverBorder: 'hover:border-purple-400/60',
      glowColor: 'purple',
      icon: Database,
      disabled: false
    },
    {
      name: 'BidWrite',
      description: 'Response Builder',
      logo: '/bidwrite-logo.svg',
      href: `/v/${clientId}/bidwrite`,
      color: 'from-blue-500/20 to-blue-600/10',
      borderColor: 'border-blue-500/30',
      hoverBorder: 'hover:border-blue-400/60',
      glowColor: 'blue',
      icon: PenTool,
      disabled: false
    },
    {
      name: 'BidGate',
      description: 'Go/No-Go Analysis',
      logo: '/bidgate-logo.svg',
      href: `/v/${clientId}/upload/bidgate`,
      color: 'from-amber-500/20 to-orange-600/10',
      borderColor: 'border-amber-500/30',
      hoverBorder: 'hover:border-amber-400/60',
      glowColor: 'amber',
      icon: BarChart3,
      disabled: false
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <svg width="160" height="40" viewBox="0 0 320 80">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00d4ff"/>
                  <stop offset="100%" stopColor="#7c3aed"/>
                </linearGradient>
              </defs>
              <text x="0" y="52" fontFamily="system-ui" fontSize="42" fontWeight="700" fill="url(#logoGrad)">BIDENGINE</text>
            </svg>
            <span className="text-gray-600">|</span>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
              <span className="text-gray-400 text-sm">Client:</span>
              <span className="text-cyan-400 font-mono text-sm font-medium">{clientId}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <a 
              href="https://hello.bidengine.co" 
              target="_blank" 
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              About
            </a>
            <a 
              href="https://docs.bidengine.co" 
              target="_blank" 
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              Docs
            </a>
            <button
              onClick={() => router.push(`/v/${clientId}/upload`)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              <Upload size={18} />
              Upload
            </button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Navigation Modules */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10"
        >
          {navModules.map((module, index) => (
            <motion.div
              key={module.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * index }}
              onClick={() => !module.disabled && router.push(module.href)}
              className={`relative group ${module.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            >
              {/* Glow effect */}
              {!module.disabled && (
                <div className={`absolute -inset-0.5 bg-gradient-to-r ${module.color} rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              )}
              
              <div className={`relative bg-gradient-to-br ${module.color} border ${module.borderColor} ${!module.disabled ? module.hoverBorder : ''} rounded-2xl p-5 transition-all duration-300 ${!module.disabled ? 'group-hover:translate-y-[-2px]' : ''}`}>
                <div className="flex items-center gap-4">
                  <Image src={module.logo} alt={module.name} width={45} height={45} className={`drop-shadow-lg ${module.disabled ? 'grayscale' : ''}`} />
                  <div className="flex-1">
                    <h3 className="text-white font-bold text-lg">{module.name}</h3>
                    <p className="text-gray-400 text-sm">{module.description}</p>
                  </div>
                  {!module.disabled && (
                    <ChevronRight className="text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-all" size={20} />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* BidVault Stats Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-10"
        >
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <Database className="text-purple-400" size={24} />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Evidence Library</h3>
                  <p className="text-gray-500 text-sm">Your BidVault contains</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                    {loadingEvidence ? '...' : totalEvidence}
                  </div>
                  <div className="text-xs text-gray-500">Evidence Records</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    {loadingEvidence ? '...' : categoriesWithData}
                  </div>
                  <div className="text-xs text-gray-500">Categories</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Active Tenders Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <PenTool className="text-blue-400" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Active Tenders</h2>
                <p className="text-gray-500 text-sm">Click a tender to view and edit responses</p>
              </div>
            </div>
            <button
              onClick={() => router.push(`/v/${clientId}/upload`)}
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              + New Tender
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 animate-pulse">
                  <div className="h-6 bg-white/10 rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-white/10 rounded w-1/2 mb-6"></div>
                  <div className="flex gap-4">
                    <div className="h-8 bg-white/10 rounded w-16"></div>
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
                onClick={() => router.push(`/v/${clientId}/upload`)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Upload Tender
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tenders.map((tender, index) => (
                <motion.div
                  key={tender._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                  onClick={() => router.push(`/v/${clientId}/bidwrite?tender=${tender._id}`)}
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
                      {tender['Created Date'] 
                        ? new Date(tender['Created Date']).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'No date'
                      }
                    </p>
                    
                    {/* Score Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r border ${getScoreGradient(tender.avgScore)}`}>
                        <TrendingUp size={14} className={getScoreColor(tender.avgScore)} />
                        <span className={`font-bold ${getScoreColor(tender.avgScore)}`}>
                          {tender.avgScore > 0 ? tender.avgScore.toFixed(1) : '-'}/10
                        </span>
                      </div>
                      <span className="text-gray-500 text-sm">
                        {tender.totalQuestions} questions
                      </span>
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
        </motion.div>
      </main>
    </div>
  );
}
