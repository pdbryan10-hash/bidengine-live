'use client';

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, FileText, CheckCircle, Loader2, GitCompare, ArrowRight,
  Plus, Minus, Zap, AlertTriangle
} from 'lucide-react';

interface TenderQuestion {
  _id: string;
  question_number: string;
  question_text: string;
  answer_text: string;
}

interface BidRefineButtonProps {
  tenderId: string;
  tenderName: string;
  clientId: string;
  questions: TenderQuestion[];
  onSuccess?: () => void;
}

export default function BidRefineButton({
  tenderId,
  tenderName,
  clientId,
  questions,
  onSuccess,
}: BidRefineButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [fileBase64, setFileBase64] = useState('');
  const [result, setResult] = useState<{ summary: string; patterns: any } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const answeredCount = questions.filter(q => q.answer_text && q.answer_text.length > 20).length;

  const resetForm = () => {
    setUploadedFileName('');
    setFileBase64('');
    setSubmitted(false);
    setResult(null);
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
      setFileBase64(base64);
    } catch {
      alert('Could not read file.');
      setUploadedFileName('');
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileBase64 || answeredCount === 0) return;

    setSubmitting(true);

    // Build original draft from current BidWrite answers
    const originalDraft = questions
      .filter(q => q.answer_text && q.answer_text.length > 20)
      .map(q => `Q${q.question_number}: ${q.question_text}\n\nANSWER:\n${q.answer_text}`)
      .join('\n\n---\n\n');

    try {
      const res = await fetch('/api/bidrefine/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          tenderId,
          tenderName,
          originalDraft,
          fileBase64,
          fileName: uploadedFileName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult({ summary: data.summary, patterns: data.patterns });
        setSubmitted(true);
        onSuccess?.();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed: ${err.error || res.status}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all bg-rose-500/10 border-rose-500/30 text-rose-400 hover:border-rose-400/50 hover:bg-rose-500/15"
      >
        <GitCompare size={15} />
        Upload Final Draft
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
                    <div className="p-2 bg-rose-500/20 rounded-xl border border-rose-500/30">
                      <GitCompare className="text-rose-400" size={20} />
                    </div>
                    <div>
                      <h2 className="text-white font-bold text-base">BidRefine — Upload Final Draft</h2>
                      <p className="text-gray-500 text-xs truncate max-w-[280px]">{tenderName}</p>
                    </div>
                  </div>
                  <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <X size={18} className="text-gray-400" />
                  </button>
                </div>

                <div className="p-6">
                  {submitted && result ? (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                      <div className="text-center mb-6">
                        <CheckCircle className="mx-auto text-rose-400 mb-3" size={40} />
                        <p className="text-white font-semibold text-lg">Refinement analysed</p>
                        <p className="text-gray-500 text-sm mt-1">Patterns saved to BidRefine</p>
                      </div>

                      <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 mb-4">
                        <p className="text-xs text-rose-400 uppercase tracking-wide font-medium mb-2">What Changed</p>
                        <p className="text-gray-300 text-sm leading-relaxed">{result.summary}</p>
                      </div>

                      {result.patterns?.style_signals?.length > 0 && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
                          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Style Signals Captured</p>
                          <ul className="space-y-1">
                            {result.patterns.style_signals.slice(0, 4).map((s: string, i: number) => (
                              <li key={i} className="text-gray-400 text-xs flex items-start gap-2">
                                <Zap size={11} className="text-rose-400 shrink-0 mt-0.5" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleClose}
                          className="flex-1 py-2.5 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
                        >
                          Close
                        </button>
                        <button
                          type="button"
                          onClick={() => { handleClose(); window.location.href = `/v/${clientId}/bidrefine`; }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                        >
                          View in BidRefine <ArrowRight size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                      {/* Tender ID */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
                          Tender ID
                        </label>
                        <div className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-gray-500 text-xs font-mono">
                          {tenderId}
                        </div>
                      </div>

                      {/* Draft status */}
                      <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-rose-400" />
                          <p className="text-sm text-rose-300 font-medium">
                            {answeredCount} question{answeredCount !== 1 ? 's' : ''} with answers captured as first draft
                          </p>
                        </div>
                        {answeredCount === 0 && (
                          <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
                            <AlertTriangle size={11} />
                            No answers yet — generate responses in BidWrite first
                          </p>
                        )}
                      </div>

                      {/* Upload */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">
                          Your Polished Final Version <span className="text-red-400">*</span>
                        </label>
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
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 border border-dashed border-white/20 hover:border-rose-500/40 rounded-xl text-sm text-gray-400 hover:text-rose-400 transition-colors disabled:opacity-50"
                        >
                          {extracting ? (
                            <><Loader2 size={16} className="animate-spin" />Reading file...</>
                          ) : uploadedFileName ? (
                            <><FileText size={16} className="text-rose-400" /><span className="text-rose-400 truncate max-w-[280px]">{uploadedFileName}</span></>
                          ) : (
                            <><Upload size={16} />Upload polished bid (PDF or Word)</>
                          )}
                        </button>
                        <p className="text-xs text-gray-600 mt-1.5">
                          Upload your human-edited final version. BidRefine will compare it to the AI first draft and extract what improved.
                        </p>
                      </div>

                      {/* Submit */}
                      <div className="flex gap-3 pt-1">
                        <button
                          type="button"
                          onClick={handleClose}
                          className="flex-1 py-2.5 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10 transition-colors text-sm font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!fileBase64 || answeredCount === 0 || submitting || extracting}
                          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            !fileBase64 || answeredCount === 0 || submitting || extracting
                              ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:opacity-90'
                          }`}
                        >
                          {submitting ? (
                            <><Loader2 size={16} className="animate-spin" />Analysing…</>
                          ) : (
                            'Analyse & Save'
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
