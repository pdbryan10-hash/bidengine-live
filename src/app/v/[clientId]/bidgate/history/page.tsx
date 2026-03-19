'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, RefreshCw, Calendar, Building2, TrendingUp, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { UserButton } from '@clerk/nextjs';

interface AnalysisSummary {
  id: string;
  tender_name: string;
  buyer_name: string | null;
  buyer_org_type: string | null;
  decision: string | null;
  readiness_score: number | null;
  win_probability: string | null;
  created_date: string;
  analysis_json: string | null;
}

export default function BidGateHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bidgate/history?clientId=${clientId}`)
      .then(r => r.json())
      .then(data => { setAnalyses(data.analyses || []); setLoading(false); })
      .catch(() => { setError('Failed to load history'); setLoading(false); });
  }, [clientId]);

  const openAnalysis = (a: AnalysisSummary) => {
    if (!a.analysis_json) return;
    try {
      const parsed = JSON.parse(a.analysis_json);
      sessionStorage.setItem('bidgate_result', JSON.stringify({
        analysis: parsed,
        tender_name: a.tender_name,
        evidence_counts: {},
        total_evidence: 0,
        bidlearn: null,
        buyer_name: a.buyer_name,
        buyer_org_type: a.buyer_org_type,
      }));
      router.push(`/v/${clientId}/bidgate?tender=${encodeURIComponent(a.tender_name || '')}`);
    } catch { /* corrupt JSON */ }
  };

  const decisionColor = (d: string | null) => {
    if (d === 'BID') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (d === 'NO BID') return 'text-red-400 bg-red-500/10 border-red-500/30';
    return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  };
  const decisionLabel = (d: string | null) => d === 'BID' ? 'GO' : d === 'NO BID' ? 'NO-GO' : 'CONDITIONAL';

  const formatDate = (s: string) => {
    try { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return s; }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push(`/v/${clientId}/bidgate`)} className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10">
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <Image src="/bidgate-logo.svg" alt="BidGate" width={36} height={36} />
              <div>
                <h1 className="text-lg font-bold text-white">BidGate History</h1>
                <p className="text-xs text-gray-500 font-medium tracking-wider">PAST ANALYSES</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/v/${clientId}/upload/bidgate`)} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold rounded-lg hover:opacity-90">
              + New Analysis
            </button>
            <button onClick={() => router.push(`/v/${clientId}`)} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300">← Dashboard</button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {loading && (
          <div className="flex justify-center py-24">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <RefreshCw className="text-amber-500" size={36} />
            </motion.div>
          </div>
        )}

        {error && (
          <div className="text-center py-24">
            <Shield className="text-gray-600 mx-auto mb-4" size={48} />
            <p className="text-gray-400 mb-2">{error}</p>
            <p className="text-gray-600 text-sm">Create a <strong className="text-gray-400">BidGate_Analysis</strong> table in Bubble with fields: client_id, tender_name, buyer_name, buyer_org_type, decision, readiness_score, win_probability, analysis_json</p>
          </div>
        )}

        {!loading && !error && analyses.length === 0 && (
          <div className="text-center py-24">
            <Shield className="text-gray-600 mx-auto mb-4" size={48} />
            <p className="text-gray-400 mb-6">No past analyses found.</p>
            <button onClick={() => router.push(`/v/${clientId}/upload/bidgate`)} className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:opacity-90">
              Run First Analysis
            </button>
          </div>
        )}

        {!loading && analyses.length > 0 && (
          <div className="space-y-4">
            <p className="text-gray-500 text-sm mb-6">{analyses.length} analysis{analyses.length !== 1 ? 'es' : ''} saved</p>
            {analyses.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => openAnalysis(a)}
                className="flex items-center gap-5 p-5 bg-white/[0.03] border border-white/10 rounded-xl hover:border-white/20 hover:bg-white/[0.05] transition-all cursor-pointer group"
              >
                {/* Decision badge */}
                <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold min-w-[80px] text-center ${decisionColor(a.decision)}`}>
                  {decisionLabel(a.decision)}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{a.tender_name || 'Unnamed Tender'}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {(a.buyer_name || a.buyer_org_type) && (
                      <span className="flex items-center gap-1">
                        <Building2 size={11} />
                        {a.buyer_name || a.buyer_org_type}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {formatDate(a.created_date)}
                    </span>
                  </div>
                </div>

                {/* Score + win prob */}
                <div className="flex items-center gap-4 shrink-0">
                  {a.readiness_score != null && (
                    <div className="text-center">
                      <p className="text-lg font-bold text-white">{typeof a.readiness_score === 'number' ? a.readiness_score.toFixed(1) : a.readiness_score}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Readiness</p>
                    </div>
                  )}
                  {a.win_probability && (
                    <div className="text-center hidden sm:block">
                      <p className="text-xs font-semibold text-amber-400">{a.win_probability.replace(/ \(.+\)/, '')}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">Win Prob</p>
                    </div>
                  )}
                  <ChevronRight size={18} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
