'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Trophy,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileText,
  Lightbulb,
  MessageSquare,
  Download,
} from 'lucide-react';
import ClientBadge from '@/components/ClientBadge';
import type { QuestionReport } from '@/app/api/bidlearn/outcome-report/route';

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  const color = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-bold text-white whitespace-nowrap" style={{ color }}>
        {score}/{max}
      </span>
    </div>
  );
}

export default function OutcomeReportPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const outcomeId = params.outcomeId as string;

  const [report, setReport] = useState<QuestionReport[] | null>(null);
  const [meta, setMeta] = useState<{
    tenderName: string;
    buyerName: string;
    outcomeResult: string;
    feedbackRaw?: string;
    hasFeedback: boolean;
    hasQuestions: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFeedback, setExpandedFeedback] = useState(false);

  const downloadPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const margin = 15;
    const maxW = 210 - margin * 2;
    let y = 20;

    const nl = (gap = 3) => { y += gap; };
    const addText = (text: string, size: number, bold = false, rgb: [number, number, number] = [30, 30, 30]) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(...rgb);
      const lines = doc.splitTextToSize(String(text || ''), maxW);
      const lineH = size * 0.45;
      if (y + lines.length * lineH > 282) { doc.addPage(); y = 20; }
      doc.text(lines, margin, y);
      y += lines.length * lineH + 1;
    };

    // Header
    addText('Q-by-Q Outcome Report', 20, true, [10, 90, 130]);
    addText(`${meta?.tenderName || ''} · ${meta?.buyerName || ''} · ${(meta?.outcomeResult || '').toUpperCase()}`, 9, false, [100, 100, 100]);
    nl(6);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, 210 - margin, y);
    nl(6);

    (report || []).forEach((q, i) => {
      const sentRgb: [number, number, number] = q.sentiment === 'positive' ? [5, 130, 90] : q.sentiment === 'negative' ? [180, 40, 40] : [80, 80, 80];
      addText(`Q${q.question_number}: ${q.question_text}`, 11, true, sentRgb);
      nl(1);
      addText(q.answer_text?.slice(0, 400) || '', 8, false, [60, 60, 60]);
      if (q.evaluator_comment) { nl(2); addText(`Evaluator: "${q.evaluator_comment}"`, 8, false, [80, 80, 80]); }
      if (q.improvement) { nl(2); addText(`To improve: ${q.improvement}`, 8, false, [140, 90, 0]); }
      if (q.resonant_phrase) { nl(2); addText(`What resonated: "${q.resonant_phrase}"`, 8, false, [70, 40, 140]); }
      nl(4);
      if (i < (report?.length || 0) - 1) {
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, y, 210 - margin, y);
        nl(4);
      }
    });

    doc.save(`${(meta?.tenderName || 'report').replace(/[^a-z0-9]/gi, '-')}-q-report.pdf`);
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const cacheKey = `outcome_report_${outcomeId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const data = JSON.parse(cached);
          setMeta({ tenderName: data.tenderName, buyerName: data.buyerName, outcomeResult: data.outcomeResult, feedbackRaw: data.feedbackRaw, hasFeedback: data.hasFeedback, hasQuestions: data.hasQuestions });
          setReport(data.questions || []);
          setLoading(false);
          return;
        }
        const res = await fetch('/api/bidlearn/outcome-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcomeId }),
        });
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || 'Failed to generate report');
          return;
        }
        const data = await res.json();
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* storage full */ }
        setMeta({ tenderName: data.tenderName, buyerName: data.buyerName, outcomeResult: data.outcomeResult, feedbackRaw: data.feedbackRaw, hasFeedback: data.hasFeedback, hasQuestions: data.hasQuestions });
        setReport(data.questions || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [outcomeId]);

  const won = meta?.outcomeResult === 'win';

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
                <FileText className="text-cyan-400" size={20} />
              </div>
              <div>
                <h1 className="text-base font-bold text-white truncate max-w-sm">
                  {meta?.tenderName ?? 'Outcome Report'}
                </h1>
                <p className="text-[10px] text-cyan-400 uppercase tracking-wider">Q-by-Q Analysis</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {meta && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold ${
                  won
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-red-500/15 text-red-400'
                }`}
              >
                {won ? <Trophy size={14} /> : <TrendingDown size={14} />}
                {won ? 'WIN' : 'LOSS'}
              </span>
            )}
            {report && report.length > 0 && (
              <button
                onClick={downloadPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:border-cyan-500/40 text-gray-400 hover:text-cyan-400 rounded-lg text-xs transition-colors"
              >
                <Download size={13} /> Download PDF
              </button>
            )}
            <ClientBadge clientId={clientId} compact />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 size={40} className="text-cyan-400 animate-spin" />
            <p className="text-gray-400 text-sm">Analysing answers against evaluator feedback…</p>
            <p className="text-gray-600 text-xs">This may take 10–15 seconds</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center">
            <AlertTriangle className="mx-auto text-red-400 mb-3" size={36} />
            <p className="text-red-400 font-medium mb-2">{error}</p>
            <button
              onClick={() => { localStorage.removeItem(`outcome_report_${outcomeId}`); window.location.reload(); }}
              className="text-xs text-gray-400 hover:text-white underline mt-2"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Meta card */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 rounded-2xl p-5 border ${
                won
                  ? 'bg-gradient-to-br from-emerald-900/20 to-transparent border-emerald-500/20'
                  : 'bg-gradient-to-br from-red-900/20 to-transparent border-red-500/20'
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-white font-semibold text-lg">{meta?.tenderName}</h2>
                  <p className="text-gray-400 text-sm mt-0.5">{meta?.buyerName}</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  {report && report.length > 0 && (
                    <>
                      <span className="text-gray-500">{report.length} questions</span>
                      <span className="text-emerald-400">
                        {report.filter(q => q.sentiment === 'positive').length} positive
                      </span>
                      <span className="text-red-400">
                        {report.filter(q => q.sentiment === 'negative').length} needs work
                      </span>
                    </>
                  )}
                </div>
              </div>
            </motion.div>

            {/* No questions fallback */}
            {!meta?.hasQuestions && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 mb-6 flex items-start gap-3"
              >
                <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 font-medium text-sm">No Q&amp;A data linked to this outcome</p>
                  <p className="text-gray-500 text-xs mt-1">
                    This outcome was not linked to a BidWrite tender. To get a Q-by-Q report, record outcomes from the
                    tender overview using the &quot;Record Outcome&quot; button inside BidWrite.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Q-by-Q Cards */}
            {report && report.length > 0 && (
              <div className="space-y-4 mb-8">
                {report.map((q, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`rounded-2xl border overflow-hidden ${
                      q.sentiment === 'positive'
                        ? 'border-emerald-500/20'
                        : q.sentiment === 'negative'
                        ? 'border-red-500/20'
                        : 'border-white/10'
                    }`}
                  >
                    {/* Question header */}
                    <div
                      className={`px-5 py-3 flex items-center justify-between gap-3 ${
                        q.sentiment === 'positive'
                          ? 'bg-emerald-900/20'
                          : q.sentiment === 'negative'
                          ? 'bg-red-900/20'
                          : 'bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span
                          className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            q.sentiment === 'positive'
                              ? 'bg-emerald-500/30 text-emerald-300'
                              : q.sentiment === 'negative'
                              ? 'bg-red-500/30 text-red-300'
                              : 'bg-white/10 text-gray-400'
                          }`}
                        >
                          Q{q.question_number}
                        </span>
                        <p className="text-white text-sm font-medium truncate">{q.question_text}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {q.bid_score !== null && q.bid_score_max !== null && (
                          <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded font-mono">
                            BidScore {q.bid_score}/{q.bid_score_max}
                          </span>
                        )}
                        {q.sentiment === 'positive' ? (
                          <CheckCircle size={16} className="text-emerald-400" />
                        ) : q.sentiment === 'negative' ? (
                          <AlertTriangle size={16} className="text-red-400" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-gray-600" />
                        )}
                      </div>
                    </div>

                    {/* Body */}
                    <div className="px-5 py-4 bg-[#0f0f0f] space-y-4">
                      {/* Answer submitted */}
                      <div>
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1.5 font-medium">
                          Answer Submitted
                        </p>
                        <p className="text-gray-400 text-xs leading-relaxed line-clamp-4">
                          {q.answer_text}
                        </p>
                      </div>

                      {/* Score bar if evaluator gave a score */}
                      {q.score_awarded !== null && q.score_max !== null && (
                        <div>
                          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1 font-medium">
                            Evaluator Score
                          </p>
                          <ScoreBar score={q.score_awarded} max={q.score_max} />
                        </div>
                      )}

                      {/* Evaluator comment */}
                      {q.evaluator_comment && (
                        <div className={`p-3 rounded-xl border-l-2 ${
                          q.sentiment === 'positive'
                            ? 'bg-emerald-500/5 border-emerald-500/50'
                            : q.sentiment === 'negative'
                            ? 'bg-red-500/5 border-red-500/50'
                            : 'bg-white/[0.03] border-gray-600'
                        }`}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <MessageSquare size={11} className="text-gray-500" />
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">
                              Evaluator Said
                            </p>
                          </div>
                          <p className="text-gray-300 text-xs leading-relaxed italic">
                            &ldquo;{q.evaluator_comment}&rdquo;
                          </p>
                        </div>
                      )}

                      {/* Resonant phrase (positive) */}
                      {q.resonant_phrase && (
                        <div className="flex items-start gap-2">
                          <Lightbulb size={13} className="text-purple-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-purple-400 uppercase tracking-widest font-medium mb-1">
                              What Resonated
                            </p>
                            <p className="text-purple-300 text-xs">
                              &ldquo;{q.resonant_phrase}&rdquo;
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Improvement note (negative/neutral) */}
                      {q.improvement && (
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] text-amber-400 uppercase tracking-widest font-medium mb-1">
                              What Was Missing / Improve
                            </p>
                            <p className="text-amber-300 text-xs leading-relaxed">
                              {q.improvement}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Raw feedback accordion */}
            {meta?.feedbackRaw && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFeedback(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-300">
                    <BarChart3 size={15} className="text-gray-500" />
                    Raw Evaluator Feedback
                  </span>
                  <span className="text-xs text-gray-600">{expandedFeedback ? 'Hide' : 'Show'}</span>
                </button>
                {expandedFeedback && (
                  <div className="px-5 pb-5">
                    <pre className="text-gray-400 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                      {meta.feedbackRaw}
                    </pre>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
