'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GitCompare, Plus, Minus, Zap, Database, Check, Ban } from 'lucide-react';

const BUBBLE_API_KEY = '33cb561a966f59ad7ea5e29a1906bf36';
const BUBBLE_API_BASE = 'https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj';

interface EvidenceCandidate {
  text: string;
  type: string;
  reusability: string;
  category: string;
}

interface BidRefineViewerProps {
  tenderId: string;
  tenderName: string;
  clientId: string;
}

const TYPE_LABELS: Record<string, string> = {
  metric: 'Metric', case_study: 'Case Study', mobilisation: 'Mobilisation',
  governance: 'Governance', compliance: 'Compliance', process: 'Process',
  social_value: 'Social Value', staffing: 'Staffing', accreditation: 'Accreditation',
};

export default function BidRefineViewer({ tenderId, tenderName, clientId }: BidRefineViewerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [candidateStates, setCandidateStates] = useState<Record<number, 'approved' | 'ignored' | 'saving'>>({});

  useEffect(() => {
    if (!tenderId) return;
    async function load() {
      setLoading(true);
      try {
        const constraints = JSON.stringify([{ key: 'tender', constraint_type: 'equals', value: tenderId }]);
        const res = await fetch(
          `${BUBBLE_API_BASE}/Refined_Draft?constraints=${encodeURIComponent(constraints)}&limit=1&sort_field=Created%20Date&descending=true`,
          { headers: { 'Authorization': `Bearer ${BUBBLE_API_KEY}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setDraft(data.response?.results?.[0] || null);
        }
      } catch { /* silently fail */ } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenderId]);

  const handleApprove = async (candidate: EvidenceCandidate, idx: number) => {
    setCandidateStates(s => ({ ...s, [idx]: 'saving' }));
    try {
      const res = await fetch('/api/bidrefine/approve-evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          tenderName,
          tenderId,
          refinedDraftId: draft?._id,
          candidate,
        }),
      });
      setCandidateStates(s => ({ ...s, [idx]: res.ok ? 'approved' : 'ignored' }));
    } catch {
      setCandidateStates(s => ({ ...s, [idx]: 'ignored' }));
    }
  };

  const handleIgnore = (idx: number) => {
    setCandidateStates(s => ({ ...s, [idx]: 'ignored' }));
  };

  if (loading || !draft) return null;

  let patterns: any = {};
  try { patterns = JSON.parse(draft.patterns_extracted); } catch { /* */ }

  const candidates: EvidenceCandidate[] = patterns.evidence_candidates || [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all bg-pink-500/10 border-pink-500/30 text-pink-400 hover:border-pink-400/50 hover:bg-pink-500/15"
      >
        <GitCompare size={15} />
        View Refinement
        {candidates.length > 0 && (
          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded font-bold">
            {candidates.filter((_, i) => !candidateStates[i]).length} new
          </span>
        )}
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-start justify-center p-4 pt-16 overflow-y-auto"
              onClick={() => setOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-lg bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden shadow-2xl mb-4"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500/20 rounded-xl border border-rose-500/30">
                      <GitCompare className="text-rose-400" size={20} />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base">Refinement Analysis</h2>
                      <p className="text-gray-500 text-xs truncate max-w-[280px]">{tenderName}</p>
                    </div>
                  </div>
                  <button onClick={() => setOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <X size={18} className="text-gray-400" />
                  </button>
                </div>

                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                  {/* Score + word delta */}
                  <div className="flex items-center gap-3">
                    {draft.improvement_score > 0 && (
                      <span className={`px-3 py-1 text-sm font-bold rounded-lg border ${
                        draft.improvement_score >= 8 ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
                        : draft.improvement_score >= 6 ? 'text-amber-400 bg-amber-500/15 border-amber-500/30'
                        : 'text-red-400 bg-red-500/15 border-red-500/30'
                      }`}>
                        +{draft.improvement_score}/10 improvement
                      </span>
                    )}
                    {draft.word_delta !== 0 && (
                      <span className={`flex items-center gap-1 text-sm font-medium ${draft.word_delta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {draft.word_delta > 0 ? <Plus size={13} /> : <Minus size={13} />}
                        {Math.abs(draft.word_delta)} words
                      </span>
                    )}
                  </div>

                  {/* Summary */}
                  {draft.diff_summary && (
                    <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4">
                      <p className="text-xs text-rose-400 uppercase tracking-wide font-medium mb-2">What Changed</p>
                      <p className="text-gray-300 text-sm leading-relaxed">{draft.diff_summary}</p>
                    </div>
                  )}

                  {/* Evidence candidates */}
                  {candidates.length > 0 && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                      <p className="text-xs text-amber-400 uppercase tracking-wide font-medium mb-3 flex items-center gap-1.5">
                        <Database size={11} />
                        New Evidence Detected — {candidates.length} reusable data point{candidates.length !== 1 ? 's' : ''}
                      </p>
                      <div className="space-y-2">
                        {candidates.map((c, i) => {
                          const state = candidateStates[i];
                          return (
                            <div key={i} className={`rounded-lg border p-3 transition-colors ${
                              state === 'approved' ? 'border-emerald-500/30 bg-emerald-500/5'
                              : state === 'ignored' ? 'border-white/5 bg-white/[0.02] opacity-40'
                              : 'border-white/10 bg-white/[0.02]'
                            }`}>
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs text-amber-400 font-medium px-1.5 py-0.5 bg-amber-500/10 rounded">
                                      {TYPE_LABELS[c.type] || c.type}
                                    </span>
                                    <span className="text-xs text-gray-600">{c.category}</span>
                                  </div>
                                  <p className="text-gray-300 text-xs leading-relaxed">{c.text}</p>
                                </div>
                                {!state && (
                                  <div className="flex gap-1 shrink-0 mt-0.5">
                                    <button
                                      onClick={() => handleApprove(c, i)}
                                      title="Add to BidVault"
                                      className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                                    >
                                      <Check size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleIgnore(i)}
                                      title="Ignore"
                                      className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:bg-white/10 transition-colors"
                                    >
                                      <Ban size={12} />
                                    </button>
                                  </div>
                                )}
                                {state === 'approved' && <Check size={14} className="text-emerald-400 shrink-0 mt-1" />}
                                {state === 'saving' && <span className="text-xs text-gray-500 shrink-0 mt-1">saving…</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-600 mt-3">✓ adds to BidVault · ✗ ignores</p>
                    </div>
                  )}

                  {/* Additions */}
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

                  {/* Deletions */}
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

                  {/* Style signals */}
                  {patterns.style_signals?.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2 flex items-center gap-1">
                        <Zap size={11} className="text-rose-400" /> Style Signals
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {patterns.style_signals.map((s: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-lg">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Flags */}
                  <div className="flex flex-wrap gap-3 text-xs">
                    {patterns.evidence_inserted && <span className="text-cyan-400">✓ Evidence inserted</span>}
                    {patterns.quantification_added && <span className="text-cyan-400">✓ Numbers added</span>}
                    {patterns.compliance_strengthened && <span className="text-cyan-400">✓ Compliance strengthened</span>}
                    {patterns.tone_change && patterns.tone_change !== 'same' && (
                      <span className="text-gray-500">Tone: {patterns.tone_change}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
