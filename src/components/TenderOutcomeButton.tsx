'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, TrendingDown, CheckCircle, Loader2, BarChart3, Upload, FileText, ArrowRight } from 'lucide-react';

const BUYER_ORG_TYPES = [
  'Local Authority',
  'NHS Trust',
  'Central Government',
  'Housing Association',
  'University / HEI',
  'Police / Emergency Services',
  'Arm\'s Length Body',
  'Private Sector',
  'Other Public Sector',
];

interface TenderOutcomeButtonProps {
  tenderId: string;
  tenderName: string;
  clientId: string;
  existingOutcome?: 'win' | 'loss';
  onSuccess?: () => void;
}

export default function TenderOutcomeButton({
  tenderId,
  tenderName,
  clientId,
  existingOutcome,
  onSuccess,
}: TenderOutcomeButtonProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasFeedback, setHasFeedback] = useState(false);

  const [buyerName, setBuyerName] = useState('');
  const [buyerOrgType, setBuyerOrgType] = useState('');
  const [outcome, setOutcome] = useState<'win' | 'loss' | ''>('');
  const [contractValue, setContractValue] = useState('');
  const [feedbackRaw, setFeedbackRaw] = useState('');
  const [notes, setNotes] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [extracting, setExtracting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setBuyerName('');
    setBuyerOrgType('');
    setOutcome('');
    setContractValue('');
    setFeedbackRaw('');
    setNotes('');
    setUploadedFileName('');
    setSubmitted(false);
    setHasFeedback(false);
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(resetForm, 300);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtracting(true);
    setUploadedFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      const res = await fetch('/api/bidlearn/extract-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64, fileName: file.name }),
      });

      if (res.ok) {
        const { text } = await res.json();
        setFeedbackRaw(text);
      } else {
        alert('Could not extract text from document. Try pasting the feedback manually.');
        setUploadedFileName('');
      }
    } catch {
      alert('Upload failed. Try pasting the feedback manually.');
      setUploadedFileName('');
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim() || !outcome) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/bidlearn/record-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: clientId,
          tender: tenderId,
          tender_name: tenderName,
          buyer_name: buyerName.trim(),
          buyer_org_type: buyerOrgType || undefined,
          outcome,
          contract_value: contractValue ? parseFloat(contractValue) : undefined,
          feedback_raw: feedbackRaw.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (res.ok) {
        const withFeedback = !!feedbackRaw.trim();
        setHasFeedback(withFeedback);
        setSubmitted(true);
        onSuccess?.();
        if (!withFeedback) {
          setTimeout(handleClose, 1500);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to record outcome: ${errData.detail || errData.error || res.status}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const outcomeColor = existingOutcome === 'win' ? 'text-emerald-400' : existingOutcome === 'loss' ? 'text-red-400' : 'text-gray-400';
  const outcomeBg = existingOutcome === 'win'
    ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-400/50'
    : existingOutcome === 'loss'
    ? 'bg-red-500/10 border-red-500/30 hover:border-red-400/50'
    : 'bg-white/5 border-white/10 hover:border-white/20';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${outcomeBg} ${outcomeColor}`}
      >
        <BarChart3 size={15} />
        {existingOutcome === 'win' && 'Won'}
        {existingOutcome === 'loss' && 'Lost'}
        {!existingOutcome && 'Record Outcome'}
      </button>

      {createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-start justify-center p-4 pt-16 overflow-y-auto"
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
                  <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
                    <BarChart3 className="text-cyan-400" size={20} />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-base">Record Bid Outcome</h2>
                    <p className="text-gray-500 text-xs truncate max-w-[280px]">{tenderName}</p>
                  </div>
                </div>
                <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X size={18} className="text-gray-400" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                {submitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <CheckCircle className="mx-auto text-emerald-400 mb-4" size={48} />
                    <p className="text-white font-semibold text-lg">Outcome recorded</p>
                    {hasFeedback ? (
                      <>
                        <div className="flex items-center justify-center gap-2 mt-3 text-cyan-400 text-sm">
                          <Loader2 size={16} className="animate-spin" />
                          Analysing feedback in the background…
                        </div>
                        <p className="text-gray-500 text-xs mt-2 mb-5">
                          Head to BidLearn to see the Q-by-Q report once processing completes.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            handleClose();
                            router.push(`/v/${clientId}/bidlearn`);
                          }}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                        >
                          View in BidLearn <ArrowRight size={15} />
                        </button>
                      </>
                    ) : null}
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Buyer Name */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
                        Buyer / Contracting Authority <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={buyerName}
                        onChange={e => setBuyerName(e.target.value)}
                        placeholder="e.g. Manchester City Council"
                        required
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-cyan-500/50 text-white text-sm placeholder-gray-600 transition-colors"
                      />
                    </div>

                    {/* Buyer Org Type */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
                        Organisation Type
                      </label>
                      <select
                        value={buyerOrgType}
                        onChange={e => setBuyerOrgType(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-cyan-500/50 text-white text-sm transition-colors appearance-none"
                      >
                        <option value="" className="bg-[#0f0f0f]">Select type...</option>
                        {BUYER_ORG_TYPES.map(t => (
                          <option key={t} value={t} className="bg-[#0f0f0f]">{t}</option>
                        ))}
                      </select>
                    </div>

                    {/* Outcome - Win / Loss */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
                        Outcome <span className="text-red-400">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setOutcome('win')}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition-all ${
                            outcome === 'win'
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:border-emerald-500/40 hover:text-emerald-400'
                          }`}
                        >
                          <Trophy size={18} />
                          Win
                        </button>
                        <button
                          type="button"
                          onClick={() => setOutcome('loss')}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm transition-all ${
                            outcome === 'loss'
                              ? 'bg-red-500/20 border-red-500 text-red-400'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:border-red-500/40 hover:text-red-400'
                          }`}
                        >
                          <TrendingDown size={18} />
                          Loss
                        </button>
                      </div>
                    </div>

                    {/* Contract Value */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
                        Contract Value (£) <span className="text-gray-600">optional</span>
                      </label>
                      <input
                        type="number"
                        value={contractValue}
                        onChange={e => setContractValue(e.target.value)}
                        placeholder="e.g. 500000"
                        min="0"
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-cyan-500/50 text-white text-sm placeholder-gray-600 transition-colors"
                      />
                    </div>

                    {/* Evaluator Feedback */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
                        Evaluator Feedback <span className="text-gray-600">optional</span>
                      </label>

                      {/* Upload button */}
                      <div className="mb-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={extracting}
                          className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 hover:border-cyan-500/40 rounded-lg text-sm text-gray-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
                        >
                          {extracting ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Extracting text...
                            </>
                          ) : uploadedFileName ? (
                            <>
                              <FileText size={14} className="text-cyan-400" />
                              <span className="text-cyan-400 truncate max-w-[240px]">{uploadedFileName}</span>
                            </>
                          ) : (
                            <>
                              <Upload size={14} />
                              Upload feedback document (PDF or Word)
                            </>
                          )}
                        </button>
                      </div>

                      <textarea
                        value={feedbackRaw}
                        onChange={e => setFeedbackRaw(e.target.value)}
                        placeholder="Or paste the full evaluator feedback here. The AI will extract category-level insights and score patterns..."
                        rows={4}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-cyan-500/50 text-white text-sm placeholder-gray-600 transition-colors resize-none"
                      />
                      {feedbackRaw.trim().length > 0 && (
                        <p className="text-xs text-cyan-500 mt-1">
                          Feedback will be analysed by AI to extract category insights and build your buyer profile.
                        </p>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
                        Internal Notes <span className="text-gray-600">optional</span>
                      </label>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Any additional context, e.g. price position, competitor intelligence..."
                        rows={2}
                        className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-cyan-500/50 text-white text-sm placeholder-gray-600 transition-colors resize-none"
                      />
                    </div>

                    {/* Submit */}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="flex-1 py-2.5 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!buyerName.trim() || !outcome || submitting}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                          !buyerName.trim() || !outcome || submitting
                            ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90'
                        }`}
                      >
                        {submitting ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Outcome'
                        )}
                      </button>
                    </div>
                  </form>
                )}
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
