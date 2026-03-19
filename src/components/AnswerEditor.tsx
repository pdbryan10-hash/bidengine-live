'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Save, CheckCircle, AlertTriangle, FileText, Target, TrendingUp,
  AlertCircle as AlertIcon, XCircle, Lightbulb, BarChart3, Shield
} from 'lucide-react';
import { TenderQuestion } from '@/types';
import { parseFullEvaluation, updateQuestion, getScoreColor, getScoreLabel } from '@/lib/bubble';
import { RichTextEditor } from './RichTextEditor';

interface AnswerEditorProps {
  question: TenderQuestion;
  onClose: () => void;
  onSave: () => void;
}

export function AnswerEditor({ question, onClose, onSave }: AnswerEditorProps) {
  const [answerText, setAnswerText] = useState(question.answer_text || '');
  const [status, setStatus] = useState(question.status || 'pending');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'score' | 'gaps' | 'evidence'>('score');
  
  const eval_ = parseFullEvaluation(question.final_evaluation || '');
  const wordCount = answerText.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateQuestion(question._id, { answer_text: answerText, status });
      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
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
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#12121a]">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg font-bold">{question.question_number}</span>
              <span className="text-gray-400 text-sm">{question.section}</span>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <div className="flex h-[calc(90vh-130px)]">
            {/* Left - Editor */}
            <div className="flex-1 p-5 overflow-y-auto border-r border-white/10">
              {/* Question */}
              <div className="mb-5 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                <div className="flex items-center gap-2 text-purple-400 text-xs font-medium mb-2">
                  <FileText size={12} />
                  QUESTION
                </div>
                <p className="text-gray-200 leading-relaxed">{question.question_text}</p>
              </div>

              {/* Response Editor */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-400 font-medium">Your Response</label>
                  <span className="text-xs text-gray-500">{wordCount} words</span>
                </div>
                <RichTextEditor content={answerText} onChange={setAnswerText} />
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Status:</span>
                {[
                  { value: 'draft', label: 'Draft', color: 'amber' },
                  { value: 'in_review', label: 'In Review', color: 'purple' },
                  { value: 'final', label: 'Final', color: 'emerald' }
                ].map(s => (
                  <button
                    key={s.value}
                    onClick={() => setStatus(s.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                      status === s.value
                        ? s.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : s.color === 'purple' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-white/5 text-gray-500 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right - Evaluation Panel */}
            <div className="w-[420px] flex flex-col bg-[#0a0a12]">
              {/* Score Header */}
              <div className="p-5 border-b border-white/10 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Score</p>
                <div className="flex items-center justify-center gap-2">
                  <span 
                    className="text-5xl font-bold"
                    style={{ color: getScoreColor(eval_.score) }}
                  >
                    {eval_.score > 0 ? eval_.score.toFixed(1) : '-'}
                  </span>
                  <span className="text-gray-500 text-2xl">/10</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">{eval_.score > 0 ? getScoreLabel(eval_.score) : 'Not scored'}</p>
                
                {/* Score Potential */}
                {eval_.scorePotential && (
                  <div className="mt-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <p className="text-xs text-emerald-400">
                      <TrendingUp size={12} className="inline mr-1" />
                      {eval_.scorePotential}
                    </p>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-white/10">
                {[
                  { id: 'score', label: 'Analysis', icon: BarChart3 },
                  { id: 'gaps', label: 'Gaps', icon: AlertIcon },
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
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* Score Analysis Tab */}
                {activeTab === 'score' && (
                  <>
                    {/* Summary */}
                    {eval_.summary && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Summary</p>
                        <p className="text-sm text-gray-300 leading-relaxed">{eval_.summary}</p>
                      </div>
                    )}

                    {/* Compliance */}
                    {eval_.complianceChecks.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <CheckCircle size={12} className="text-emerald-400" />
                          Compliance Check
                        </p>
                        <ul className="space-y-1.5">
                          {eval_.complianceChecks.map((c, i) => (
                            <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                              <span className="text-emerald-400 mt-0.5">✓</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Top Improvements */}
                    {eval_.topImprovements.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Lightbulb size={12} className="text-amber-400" />
                          Top 3 Improvements
                        </p>
                        <ol className="space-y-2">
                          {eval_.topImprovements.map((imp, i) => (
                            <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
                              <span>{imp}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Score Breakdown */}
                    {eval_.scoreBreakdown.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Score Breakdown</p>
                        <ul className="space-y-1">
                          {eval_.scoreBreakdown.map((item, i) => (
                            <li key={i} className="text-xs text-gray-500">{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}

                {/* Gap Analysis Tab */}
                {activeTab === 'gaps' && (
                  <>
                    {/* Must Fix */}
                    {eval_.gapAnalysis.mustFix.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wider mb-2 flex items-center gap-1 text-red-400">
                          🔴 MUST FIX
                        </p>
                        <ul className="space-y-2">
                          {eval_.gapAnalysis.mustFix.map((item, i) => (
                            <li key={i} className="text-sm text-gray-300 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Should Fix */}
                    {eval_.gapAnalysis.shouldFix.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wider mb-2 flex items-center gap-1 text-amber-400">
                          🟠 SHOULD FIX
                        </p>
                        <ul className="space-y-2">
                          {eval_.gapAnalysis.shouldFix.map((item, i) => (
                            <li key={i} className="text-sm text-gray-300 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Could Fix */}
                    {eval_.gapAnalysis.couldFix.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-wider mb-2 flex items-center gap-1 text-emerald-400">
                          🟢 COULD FIX
                        </p>
                        <ul className="space-y-2">
                          {eval_.gapAnalysis.couldFix.map((item, i) => (
                            <li key={i} className="text-sm text-gray-300 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Evidence Gaps */}
                    {eval_.evidenceGaps.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Evidence Gaps Flagged</p>
                        <ul className="space-y-1.5">
                          {eval_.evidenceGaps.map((gap, i) => (
                            <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                              <span className="text-amber-400 mt-0.5">⚠</span>
                              <span>{gap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {eval_.gapAnalysis.mustFix.length === 0 && eval_.gapAnalysis.shouldFix.length === 0 && eval_.gapAnalysis.couldFix.length === 0 && eval_.evidenceGaps.length === 0 && (
                      <div className="text-center py-10">
                        <CheckCircle className="mx-auto text-emerald-400 mb-2" size={32} />
                        <p className="text-gray-400">No gaps identified</p>
                      </div>
                    )}
                  </>
                )}

                {/* Evidence Tab */}
                {activeTab === 'evidence' && (
                  <>
                    {/* Evidence Quality */}
                    {eval_.evidenceQuality.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Evidence Quality</p>
                        <ul className="space-y-2">
                          {eval_.evidenceQuality.map((item, i) => {
                            const isVerified = item.includes('Verifiable ✓') || item.includes('✓');
                            const isGap = item.includes('EVIDENCE GAP') || item.includes('Gap');
                            return (
                              <li 
                                key={i} 
                                className={`text-sm p-2 rounded-lg border ${
                                  isVerified ? 'bg-emerald-500/10 border-emerald-500/20 text-gray-300' :
                                  isGap ? 'bg-amber-500/10 border-amber-500/20 text-gray-300' :
                                  'bg-white/5 border-white/10 text-gray-400'
                                }`}
                              >
                                {item}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}

                    {/* Governance Checks */}
                    {eval_.governanceChecks.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Governance / Monitoring / Repeatability</p>
                        <ul className="space-y-1.5">
                          {eval_.governanceChecks.map((item, i) => (
                            <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                              <span className={item.includes('✓') ? 'text-emerald-400' : 'text-gray-500'}>
                                {item.includes('✓') ? '✓' : '•'}
                              </span>
                              <span>{item.replace('✓', '').trim()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Banned Words */}
                    {eval_.bannedWords.length > 0 && (
                      <div>
                        <p className="text-xs text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <XCircle size={12} />
                          Banned Words Found
                        </p>
                        <ul className="space-y-1">
                          {eval_.bannedWords.map((word, i) => (
                            <li key={i} className="text-sm text-red-400 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                              {word}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Unverifiable Claims */}
                    {eval_.unverifiableClaims.length > 0 && (
                      <div>
                        <p className="text-xs text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          Unverifiable Claims
                        </p>
                        <ul className="space-y-1">
                          {eval_.unverifiableClaims.map((claim, i) => (
                            <li key={i} className="text-sm text-gray-400 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                              {claim}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {eval_.evidenceQuality.length === 0 && eval_.governanceChecks.length === 0 && (
                      <div className="text-center py-10">
                        <Shield className="mx-auto text-gray-600 mb-2" size={32} />
                        <p className="text-gray-400">No evidence data available</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-white/10 bg-[#12121a]">
            <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
