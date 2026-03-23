'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, GitCompare, RefreshCw, ChevronDown, Plus, Minus,
  Zap, FileText, Calendar, Database, Check, Ban
} from 'lucide-react';
import ClientBadge from '@/components/ClientBadge';
import BidRefineButton from '@/components/BidRefineButton';
import { UserButton } from '@clerk/nextjs';

const BUBBLE_API_KEY = '33cb561a966f59ad7ea5e29a1906bf36';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';

interface RefinedDraft {
  _id: string;
  tender_name: string;
  tender: string;
  diff_summary: string;
  patterns_extracted: string;
  word_delta: number;
  improvement_score: number;
  'Created Date'?: string;
}

function ImprovementBadge({ score }: { score: number }) {
  const color = score >= 8 ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
    : score >= 6 ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
    : 'text-red-400 bg-red-500/15 border-red-500/30';
  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded border ${color}`}>
      +{score}/10
    </span>
  );
}

export default function BidRefinePage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [drafts, setDrafts] = useState<RefinedDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [candidateStates, setCandidateStates] = useState<Record<string, 'approved' | 'ignored' | 'saving'>>({});

  const handleApprove = async (draft: RefinedDraft, candidate: any, idx: number) => {
    const key = `${draft._id}-${idx}`;
    setCandidateStates(s => ({ ...s, [key]: 'saving' }));
    try {
      const res = await fetch('/api/bidrefine/approve-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          tenderName: draft.tender_name,
          tenderId: draft.tender,
          refinedDraftId: draft._id,
          candidate,
        }),
      });
      setCandidateStates(s => ({ ...s, [key]: res.ok ? 'approved' : 'ignored' }));
    } catch {
      setCandidateStates(s => ({ ...s, [key]: 'ignored' }));
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const constraints = JSON.stringify([{ key: 'client', constraint_type: 'equals', value: clientId }]);
        const res = await fetch(
          `${BUBBLE_API_BASE}/Refined_Draft?constraints=${encodeURIComponent(constraints)}&limit=50&sort_field=Created%20Date&descending=true`,
          { headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setDrafts(data.response?.results || []);
        }
      } catch { /* silently fail */ } finally {
        setLoading(false);
      }
    }
    load();
  }, [clientId, refreshKey]);

  const totalRefinements = drafts.length;
  const avgImprovement = drafts.length > 0
    ? (drafts.reduce((sum, d) => sum + (d.improvement_score || 0), 0) / drafts.length).toFixed(1)
    : '—';

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push(`/v/${clientId}`)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/20 rounded-xl border border-rose-500/30">
                <GitCompare className="text-rose-400" size={22} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-white">BIDREFINE</h1>
                  <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-md" style={{ boxShadow: '0 0 12px rgba(244,63,94,0.4)' }}>BETA</span>
                </div>
                <p className="text-[10px] text-rose-400 uppercase tracking-wider">Refinement Learning</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ClientBadge clientId={clientId} compact />
            <div className="h-5 w-px bg-white/10" />
            <button onClick={() => setRefreshKey(k => k + 1)} className="p-2 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors">
              <RefreshCw size={18} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <BidRefineButton tenderId="" tenderName="Manual Entry" clientId={clientId} questions={[]} onSuccess={() => setRefreshKey(k => k + 1)} />
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Refinements</p>
            <div className="text-4xl font-bold text-white">{loading ? '...' : totalRefinements}</div>
            <p className="text-xs text-gray-500 mt-1">drafts uploaded</p>
          </div>
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Avg Improvement</p>
            <div className="text-4xl font-bold text-rose-400">{loading ? '...' : avgImprovement}</div>
            <p className="text-xs text-gray-500 mt-1">out of 10</p>
          </div>
          <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Style Signals</p>
            <div className="text-4xl font-bold text-pink-400">
              {loading ? '...' : drafts.reduce((sum, d) => {
                try { return sum + (JSON.parse(d.patterns_extracted)?.style_signals?.length || 0); } catch { return sum; }
              }, 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">patterns captured</p>
          </div>
        </motion.div>

        {/* Refinements list */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText size={18} className="text-gray-400" />
            Refined Drafts
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse">
                  <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-white/10 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : drafts.length === 0 ? (
            <div className="bg-white/5 border border-white/10 border-dashed rounded-2xl p-12 text-center">
              <GitCompare className="mx-auto text-gray-500 mb-4" size={48} />
              <h3 className="text-white font-medium mb-2">No refinements yet</h3>
              <p className="text-gray-500 text-sm mb-6">
                Generate a bid in BidWrite, export it, polish it, then upload the final version to start learning.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((draft, idx) => {
                let patterns: any = {};
                try { patterns = JSON.parse(draft.patterns_extracted); } catch { /* */ }
                const isExpanded = expandedId === draft._id;

                return (
                  <motion.div
                    key={draft._id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-colors"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : draft._id)}
                      className="w-full flex items-center gap-4 p-5 text-left hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="p-2 bg-rose-500/20 rounded-xl shrink-0">
                        <GitCompare size={18} className="text-rose-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{draft.tender_name || 'Unnamed Tender'}</p>
                        <p className="text-gray-500 text-sm truncate mt-0.5">{draft.diff_summary}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {draft.improvement_score > 0 && <ImprovementBadge score={draft.improvement_score} />}
                        {draft.word_delta !== 0 && (
                          <span className={`flex items-center gap-0.5 text-xs font-medium ${draft.word_delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {draft.word_delta > 0 ? <Plus size={11} /> : <Minus size={11} />}
                            {Math.abs(draft.word_delta)} words
                          </span>
                        )}
                        {draft['Created Date'] && (
                          <span className="text-gray-600 text-xs flex items-center gap-1">
                            <Calendar size={11} />
                            {new Date(draft['Created Date']).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        )}
                        <ChevronDown size={16} className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-white/10"
                        >
                          <div className="p-5 grid grid-cols-2 gap-4">
                            {patterns.evidence_candidates?.length > 0 && (
                              <div className="col-span-2 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                                <p className="text-xs text-amber-400 uppercase tracking-wide font-medium mb-3 flex items-center gap-1.5">
                                  <Database size={11} /> New Evidence — {patterns.evidence_candidates.length} candidate{patterns.evidence_candidates.length !== 1 ? 's' : ''}
                                </p>
                                <div className="space-y-2">
                                  {patterns.evidence_candidates.map((c: any, i: number) => {
                                    const key = `${draft._id}-${i}`;
                                    const state = candidateStates[key];
                                    return (
                                      <div key={i} className={`rounded-lg border p-3 transition-colors ${state === 'approved' ? 'border-emerald-500/30 bg-emerald-500/5' : state === 'ignored' ? 'border-white/5 opacity-40' : 'border-white/10 bg-white/[0.02]'}`}>
                                        <div className="flex items-start gap-2">
                                          <div className="flex-1 min-w-0">
                                            <span className="text-xs text-amber-400 font-medium px-1.5 py-0.5 bg-amber-500/10 rounded mr-2">{c.type}</span>
                                            <span className="text-xs text-gray-600">{c.category}</span>
                                            <p className="text-gray-300 text-xs leading-relaxed mt-1">{c.text}</p>
                                          </div>
                                          {!state && (
                                            <div className="flex gap-1 shrink-0">
                                              <button onClick={() => handleApprove(draft, c, i)} title="Add to BidVault" className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors"><Check size={12} /></button>
                                              <button onClick={() => setCandidateStates(s => ({ ...s, [key]: 'ignored' }))} title="Ignore" className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:bg-white/10 transition-colors"><Ban size={12} /></button>
                                            </div>
                                          )}
                                          {state === 'approved' && <Check size={14} className="text-emerald-400 shrink-0 mt-1" />}
                                          {state === 'saving' && <span className="text-xs text-gray-500 shrink-0">saving…</span>}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {patterns.additions?.length > 0 && (
                              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                                <p className="text-xs text-emerald-400 uppercase tracking-wide font-medium mb-2 flex items-center gap-1">
                                  <Plus size={11} /> Added
                                </p>
                                <ul className="space-y-1.5">
                                  {patterns.additions.slice(0, 5).map((a: string, i: number) => (
                                    <li key={i} className="text-gray-300 text-xs leading-relaxed">• {a}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {patterns.deletions?.length > 0 && (
                              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                                <p className="text-xs text-red-400 uppercase tracking-wide font-medium mb-2 flex items-center gap-1">
                                  <Minus size={11} /> Removed
                                </p>
                                <ul className="space-y-1.5">
                                  {patterns.deletions.slice(0, 5).map((d: string, i: number) => (
                                    <li key={i} className="text-gray-300 text-xs leading-relaxed">• {d}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {patterns.style_signals?.length > 0 && (
                              <div className="col-span-2 bg-rose-500/5 border border-rose-500/20 rounded-xl p-4">
                                <p className="text-xs text-rose-400 uppercase tracking-wide font-medium mb-2 flex items-center gap-1">
                                  <Zap size={11} /> Style Signals
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {patterns.style_signals.map((s: string, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-lg">{s}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="col-span-2 flex gap-4 text-xs text-gray-500">
                              {patterns.evidence_inserted && <span className="flex items-center gap-1 text-cyan-400">&#10003; Evidence inserted</span>}
                              {patterns.quantification_added && <span className="flex items-center gap-1 text-cyan-400">&#10003; Numbers added</span>}
                              {patterns.compliance_strengthened && <span className="flex items-center gap-1 text-cyan-400">&#10003; Compliance strengthened</span>}
                              {patterns.tone_change && patterns.tone_change !== 'same' && <span>Tone: {patterns.tone_change}</span>}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
