'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, FileText, CheckCircle, Clock, Edit3, 
  ChevronRight, TrendingUp, Database, PenTool, BarChart3
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { UserButton, useUser } from '@clerk/nextjs';
import { fetchTenders, fetchEvidenceCounts, fetchClientById, checkIsAdmin, EvidenceCounts } from '@/lib/bubble';
import SubscriptionBanner from '@/components/SubscriptionBanner';
import ClientBadge from '@/components/ClientBadge';
import AdminClientSelector from '@/components/AdminClientSelector';
import TenderOutcomeButton from '@/components/TenderOutcomeButton';


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
  const { user } = useUser();
  const clientId = params.clientId as string;
  
  const [tenders, setTenders] = useState<TenderWithStats[]>([]);
  const [evidenceCounts, setEvidenceCounts] = useState<EvidenceCounts>({});
  const [loading, setLoading] = useState(true);
  const [loadingEvidence, setLoadingEvidence] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('');
  const [trialEndDate, setTrialEndDate] = useState<string>('');
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [clientName, setClientName] = useState<string>('');

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

    async function loadClient() {
      const client = await fetchClientById(clientId);
      if (client) {
        setSubscriptionStatus(client.subscription_status || '');
        setTrialEndDate(client.trial_end_date || '');
        setSubscriptionEndDate(client.subscription_end_date || '');
        setClientName(client.client_name || '');
      }
    }

    async function checkAdmin() {
      const email = user?.emailAddresses?.[0]?.emailAddress;
      const adminEmails = ['paul@bidengine.co', 'paul@proofworks.co.uk'];
      setIsAdmin(adminEmails.includes(email || ''));
    }
    
    loadData();
    loadEvidence();
    loadClient();
    checkAdmin();

    // Poll every 30 seconds
    const interval = setInterval(() => {
      loadData();
      loadEvidence();
    }, 30000);

    return () => clearInterval(interval);
  }, [clientId, user?.id]);

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
    },
    {
      name: 'BidCheck',
      description: 'Pre-Submission Gate',
      logo: '/bidcheck-logo.svg',
      href: `/v/${clientId}/bidcheck`,
      color: 'from-emerald-500/20 to-cyan-600/10',
      borderColor: 'border-emerald-500/30',
      hoverBorder: 'hover:border-emerald-400/60',
      glowColor: 'emerald',
      icon: CheckCircle,
      disabled: false
    },
    {
      name: 'BidLearn',
      description: 'Outcome Intelligence',
      logo: '/bidlearn-logo.svg',
      href: `/v/${clientId}/bidlearn`,
      color: 'from-cyan-500/20 to-teal-600/10',
      borderColor: 'border-cyan-500/30',
      hoverBorder: 'hover:border-cyan-400/60',
      glowColor: 'cyan',
      icon: TrendingUp,
      disabled: false
    }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Geometric Icon */}
            <svg width="36" height="36" viewBox="0 0 40 40">
              <defs>
                <linearGradient id="iconGradDB" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00d4ff"/>
                  <stop offset="50%" stopColor="#7c3aed"/>
                  <stop offset="100%" stopColor="#f472b6"/>
                </linearGradient>
              </defs>
              <polygon points="8,4 32,20 8,36" fill="url(#iconGradDB)" opacity="0.9"/>
              <polygon points="14,8 34,20 14,32" fill="url(#iconGradDB)" opacity="0.6"/>
              <polygon points="20,12 38,20 20,28" fill="url(#iconGradDB)" opacity="0.3"/>
            </svg>
            {/* Logo Text */}
            <svg width="260" height="45" viewBox="0 0 280 50" style={{filter: 'drop-shadow(0 0 15px rgba(0,212,255,0.5))'}}>
              <defs>
                <linearGradient id="logoGradDB" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00d4ff"/>
                  <stop offset="50%" stopColor="#7c3aed"/>
                  <stop offset="100%" stopColor="#f472b6"/>
                </linearGradient>
                <linearGradient id="betaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f472b6"/>
                  <stop offset="50%" stopColor="#ec4899"/>
                  <stop offset="100%" stopColor="#7c3aed"/>
                </linearGradient>
              </defs>
              <text x="0" y="35" fontFamily="system-ui, -apple-system, sans-serif" fontSize="32" fontWeight="800" letterSpacing="-1" fill="url(#logoGradDB)">BIDENGINE</text>
              <rect x="175" y="10" width="60" height="26" rx="6" fill="url(#betaGrad)" style={{filter: 'drop-shadow(0 0 8px rgba(236,72,153,0.5))'}}/>
              <text x="205" y="29" fontFamily="system-ui, -apple-system, sans-serif" fontSize="13" fontWeight="800" fill="white" textAnchor="middle">BETA</text>
            </svg>
          </div>
          
          <div className="flex items-center gap-4">
            {isAdmin ? (
              <AdminClientSelector currentClientName={clientName} />
            ) : (
              <ClientBadge clientId={clientId} />
            )}
            <div className="h-6 w-px bg-white/10" />
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
            {isAdmin && (
              <Link 
                href="/admin" 
                className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 text-amber-400 font-medium rounded-lg hover:bg-amber-500/30 transition-colors text-sm"
              >
                ⚙️ Admin
              </Link>
            )}
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
          className="grid grid-cols-4 gap-6 mb-10"
        >
          {navModules.map((module, index) => {
            const ringColor = module.glowColor === 'purple' ? '#a855f7' : 
                              module.glowColor === 'blue' ? '#3b82f6' : 
                              module.glowColor === 'emerald' ? '#00e07a' : '#f59e0b';
            return (
              <motion.div
                key={module.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                whileHover={!module.disabled ? { scale: 1.02, y: -4 } : {}}
                whileTap={!module.disabled ? { scale: 0.98 } : {}}
                onClick={() => !module.disabled && router.push(module.href)}
                className={`relative group ${module.disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className={`bg-gradient-to-br ${module.color} border-2 ${module.borderColor} ${!module.disabled ? module.hoverBorder : ''} rounded-2xl p-6 transition-all ${module.disabled ? 'opacity-60' : ''}`}>
                  {module.disabled && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full font-mono text-[9px] text-emerald-400 font-bold tracking-wider">COMING SOON</div>
                  )}
                  <div className="flex flex-col items-center text-center gap-4">
                    {/* Circular logo with spinning ring */}
                    <div className="relative w-20 h-20">
                      {!module.disabled && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{ 
                            border: `2px solid transparent`,
                            borderTopColor: ringColor,
                            borderRightColor: ringColor
                          }}
                          animate={{ rotate: 360 }}
                          transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                        />
                      )}
                      <div className="absolute inset-2 rounded-full bg-black/30 flex items-center justify-center">
                        <Image 
                          src={module.logo} 
                          alt={module.name} 
                          width={40} 
                          height={40}
                          className={`drop-shadow-lg ${module.disabled ? 'grayscale' : ''}`}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-white font-bold text-xl">{module.name}</h3>
                      <p className="text-gray-400 text-sm mt-1">{module.description}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
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
            <div className="flex items-center gap-4">
              <Image src="/bidwrite-logo.svg" alt="BidWrite" width={100} height={32} />
              <div className="h-6 w-px bg-white/10" />
              <p className="text-gray-500 text-sm">Click a tender to view and edit responses</p>
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
                    
                    {/* Status Counts + Record Outcome */}
                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <div className="flex gap-3">
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
                      <div onClick={e => e.stopPropagation()}>
                        <TenderOutcomeButton
                          tenderId={tender._id}
                          tenderName={tender.tender_name}
                          clientId={clientId}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black/30 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex items-center justify-center">
          <div className="flex items-center gap-4 opacity-60 hover:opacity-100 transition-opacity">
            {/* Infinity DNA Icon */}
            <svg width="40" height="40" viewBox="0 0 80 80">
              <defs>
                <linearGradient id="pwFooterDB" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6"/>
                  <stop offset="50%" stopColor="#06b6d4"/>
                  <stop offset="100%" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
              <path d="M10,40 C10,20 25,20 40,40 C55,60 70,60 70,40 C70,20 55,20 40,40 C25,60 10,60 10,40" 
                    stroke="url(#pwFooterDB)" strokeWidth="4" fill="none"/>
              <circle cx="40" cy="40" r="6" fill="url(#pwFooterDB)"/>
            </svg>
            {/* ProofWorks Limited Text */}
            <svg width="200" height="45" viewBox="0 0 220 50" style={{filter: 'drop-shadow(0 0 10px rgba(139,92,246,0.4))'}}>
              <defs>
                <linearGradient id="pwTextDB" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6"/>
                  <stop offset="50%" stopColor="#06b6d4"/>
                  <stop offset="100%" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
              <text x="0" y="32" fontFamily="system-ui, -apple-system, sans-serif" fontSize="28" fontWeight="700" fill="url(#pwTextDB)">ProofWorks</text>
              <text x="0" y="46" fontFamily="system-ui, -apple-system, sans-serif" fontSize="12" fontWeight="500" letterSpacing="2" fill="#6b7280">LIMITED</text>
            </svg>
          </div>
        </div>
      </footer>
    </div>
  );
}
