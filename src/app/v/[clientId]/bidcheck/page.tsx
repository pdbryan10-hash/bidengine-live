'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Upload, CheckCircle, AlertCircle, TrendingUp, ChevronRight, ChevronDown, RotateCw, FileText, Loader2, Download } from 'lucide-react';
import Image from 'next/image';
import { UserButton } from '@clerk/nextjs';

const CHUNK_SIZE = 30000;
const CHUNK_OVERLAP = 3000;

interface Question {
  id: string;
  question_number: string;
  question_text: string;
  answer_text: string;
  section: string;
  word_limit?: number | null;
  weighting?: string | null;
  score?: number;
  mustFix?: string;
  shouldFix?: string;
  niceToHave?: string;
  strengths?: string[];
  compliance?: string[];
  primaryGap?: string;
  scorePotential?: string;
  status: 'pending' | 'scoring' | 'done';
}

type Phase = 'upload' | 'extracting' | 'scoring' | 'results';

function getScoreColor(score: number) {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 7) return 'text-amber-400';
  if (score > 0) return 'text-red-400';
  return 'text-gray-500';
}

function getScoreBg(score: number) {
  if (score >= 8) return 'bg-emerald-500/10 border-emerald-500/25';
  if (score >= 7) return 'bg-amber-500/10 border-amber-500/25';
  if (score > 0) return 'bg-red-500/10 border-red-500/25';
  return 'bg-white/5 border-white/10';
}

function getGateLabel(score: number) {
  if (score >= 8) return { label: 'CLEAR', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
  if (score >= 7) return { label: 'REVIEW', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
  return { label: 'FIX', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' };
}

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = (size / 2) - 6;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 10) * circumference;
  const color = score >= 8 ? '#00e07a' : score >= 7 ? '#ffb020' : '#ff4560';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-lg font-bold leading-none" style={{ color }}>{score.toFixed(1)}</span>
        <span className="font-mono text-[9px] text-gray-500">/10</span>
      </div>
    </div>
  );
}

function PulsingSpinner({ size = 80 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-emerald-500/30"
        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-cyan-500/20"
        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      />
      <svg className="absolute inset-0 animate-spin" style={{ animationDuration: '1.5s' }} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(0,224,122,0.1)" strokeWidth="4" />
        <circle cx="40" cy="40" r="34" fill="none" stroke="url(#spinGrad)" strokeWidth="4"
          strokeDasharray="213" strokeDashoffset="140" strokeLinecap="round" />
        <defs>
          <linearGradient id="spinGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00e07a" />
            <stop offset="100%" stopColor="#00b4d8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <FileText className="text-emerald-400" size={24} />
        </motion.div>
      </div>
    </div>
  );
}

export default function BidCheckPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [phase, setPhase] = useState<Phase>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [extractProgress, setExtractProgress] = useState({ found: 0, chunk: 0, total: 1 });
  const [scoreProgress, setScoreProgress] = useState({ current: 0, total: 0 });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'fix' | 'clear'>('all');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Elapsed timer — ticks every second while processing
  useEffect(() => {
    if (!startTime || phase === 'upload' || phase === 'results') return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, phase]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? m + 'm ' + s.toString().padStart(2, '0') + 's' : s + 's';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  // ─── EXPORT REPORT ─────────────────────────────────────────────────────────

  function exportReport() {
    const done = questions.filter(q => q.status === 'done' && q.score !== undefined);
    const avg = done.length > 0 ? done.reduce((s, q) => s + (q.score ?? 0), 0) / done.length : 0;
    const clear = done.filter(q => (q.score ?? 0) >= 8).length;
    const review = done.filter(q => (q.score ?? 0) >= 7 && (q.score ?? 0) < 8).length;
    const fix = done.filter(q => (q.score ?? 0) < 7 && (q.score ?? 0) > 0).length;
    const gate = avg >= 7.5 && fix === 0 ? 'PASS' : 'REVIEW REQUIRED';
    const recoverable = done
      .filter(q => (q.score ?? 0) < 8 && (q.score ?? 0) > 0)
      .reduce((s, q) => s + (8.5 - (q.score ?? 0)), 0);
    const sorted = [...done].sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    const scoreColor = (s: number) => s >= 8 ? '#00e07a' : s >= 7 ? '#ffb020' : '#ff4560';

    let qHTML = '';
    sorted.forEach(q => {
      const s = q.score ?? 0;
      const status = s >= 8 ? 'CLEAR' : s >= 7 ? 'REVIEW' : 'FIX';
      qHTML += '<div style="page-break-inside:avoid;border:1px solid #333;border-left:4px solid ' + scoreColor(s) + ';border-radius:8px;padding:20px;margin-bottom:20px;background:#111">';
      qHTML += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">';
      qHTML += '<div style="flex:1"><span style="font-family:monospace;font-size:10px;color:#888;text-transform:uppercase">Q' + esc(q.question_number) + ' · ' + esc(q.section) + '</span>';
      qHTML += '<span style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold;color:' + scoreColor(s) + ';background:' + scoreColor(s) + '15;border:1px solid ' + scoreColor(s) + '40">' + status + '</span></div>';
      qHTML += '<div style="font-family:monospace;font-size:28px;font-weight:bold;color:' + scoreColor(s) + '">' + s.toFixed(1) + '</div></div>';

      qHTML += '<h3 style="color:#fff;font-size:14px;margin:0 0 8px 0">' + esc(q.question_text) + '</h3>';
      if (q.primaryGap) qHTML += '<div style="display:inline-block;padding:4px 12px;background:#ff456015;border:1px solid #ff456040;border-radius:6px;color:#ff4560;font-size:11px;font-family:monospace;margin-bottom:12px">🔴 ' + esc(q.primaryGap) + '</div>';
      if (q.scorePotential) qHTML += '<div style="padding:8px 12px;background:#00e07a10;border:1px solid #00e07a30;border-radius:6px;color:#00e07a;font-size:11px;margin-bottom:12px">↑ ' + esc(q.scorePotential) + '</div>';

      qHTML += '<div style="background:#0a0a0a;border:1px solid #222;border-radius:6px;padding:12px;margin-bottom:12px;max-height:200px;overflow-y:auto">';
      qHTML += '<p style="font-size:9px;font-family:monospace;color:#666;text-transform:uppercase;margin:0 0 6px 0">📝 Bidder\'s Answer</p>';
      qHTML += '<p style="font-size:11px;color:#999;line-height:1.6;margin:0;white-space:pre-line">' + esc(q.answer_text) + '</p></div>';

      const sections = [
        { label: 'Must Fix', content: q.mustFix, color: '#ff4560' },
        { label: 'Should Fix', content: q.shouldFix, color: '#ffb020' },
        { label: 'Could Fix', content: q.niceToHave, color: '#60a5fa' },
      ];
      sections.forEach(sec => {
        if (sec.content) {
          qHTML += '<div style="margin-bottom:10px"><p style="font-size:9px;font-family:monospace;color:' + sec.color + ';text-transform:uppercase;margin:0 0 4px 0">' + sec.label + '</p>';
          qHTML += '<p style="font-size:11px;color:#ccc;line-height:1.6;margin:0;white-space:pre-line">' + esc(sec.content) + '</p></div>';
        }
      });

      if (q.strengths && q.strengths.length > 0) {
        qHTML += '<div style="margin-bottom:10px"><p style="font-size:9px;font-family:monospace;color:#00e07a;text-transform:uppercase;margin:0 0 4px 0">✓ Strengths</p>';
        q.strengths.forEach(s => { qHTML += '<p style="font-size:11px;color:#ccc;margin:2px 0">✓ ' + esc(s) + '</p>'; });
        qHTML += '</div>';
      }
      if (q.compliance && q.compliance.length > 0) {
        qHTML += '<div style="margin-bottom:10px"><p style="font-size:9px;font-family:monospace;color:#a78bfa;text-transform:uppercase;margin:0 0 4px 0">📋 Compliance</p>';
        q.compliance.forEach(c => { qHTML += '<p style="font-size:11px;color:#ccc;margin:2px 0">' + esc(c) + '</p>'; });
        qHTML += '</div>';
      }
      qHTML += '</div>';
    });

    const html = '<!DOCTYPE html><html><head><title>BidCheck Report — ' + esc(fileName) + '</title>' +
      '<style>@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>' +
      '<body style="background:#0a0a0a;color:#e2e8f0;font-family:-apple-system,system-ui,sans-serif;max-width:900px;margin:0 auto;padding:40px 30px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:30px;padding-bottom:20px;border-bottom:1px solid #333">' +
      '<div><h1 style="margin:0;font-size:24px;color:#fff">BidCheck</h1><p style="margin:4px 0 0;font-size:10px;color:#00e07a;font-family:monospace;text-transform:uppercase;letter-spacing:2px">Pre-Submission Gate Report</p></div>' +
      '<div style="text-align:right"><p style="margin:0;font-size:12px;color:#888">' + esc(fileName) + '</p><p style="margin:4px 0 0;font-size:11px;color:#666">' + dateStr + '</p></div></div>' +

      '<div style="display:flex;gap:16px;margin-bottom:24px">' +
      '<div style="flex:1;background:#111;border:1px solid #333;border-radius:8px;padding:16px;text-align:center">' +
      '<p style="font-size:9px;font-family:monospace;color:#888;text-transform:uppercase;margin:0 0 8px">Gate Status</p>' +
      '<p style="font-size:22px;font-weight:bold;margin:0;color:' + (gate === 'PASS' ? '#00e07a' : '#ffb020') + '">' + gate + '</p></div>' +
      '<div style="flex:1;background:#111;border:1px solid #333;border-radius:8px;padding:16px;text-align:center">' +
      '<p style="font-size:9px;font-family:monospace;color:#888;text-transform:uppercase;margin:0 0 8px">Avg Score</p>' +
      '<p style="font-size:22px;font-weight:bold;margin:0;color:' + scoreColor(avg) + '">' + avg.toFixed(1) + '/10</p></div>' +
      '<div style="flex:1;background:#111;border:1px solid #333;border-radius:8px;padding:16px;text-align:center">' +
      '<p style="font-size:9px;font-family:monospace;color:#888;text-transform:uppercase;margin:0 0 8px">Questions</p>' +
      '<p style="font-size:22px;font-weight:bold;margin:0;color:#fff">' + done.length + '</p></div>' +
      '<div style="flex:1;background:#111;border:1px solid #333;border-radius:8px;padding:16px;text-align:center">' +
      '<p style="font-size:9px;font-family:monospace;color:#888;text-transform:uppercase;margin:0 0 8px">Clear / Review / Fix</p>' +
      '<p style="font-size:22px;font-weight:bold;margin:0"><span style="color:#00e07a">' + clear + '</span> / <span style="color:#ffb020">' + review + '</span> / <span style="color:#ff4560">' + fix + '</span></p></div>' +
      '</div>' +

      qHTML +

      '<p style="text-align:center;font-size:10px;color:#555;font-family:monospace;margin-top:40px;padding-top:20px;border-top:1px solid #222">Generated by BidEngine BidCheck · ' + new Date().toISOString() + '</p>' +
      '</body></html>';

    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }

  // ─── PROCESS FILE ──────────────────────────────────────────────────────────

  async function processFile(file: File) {
    if (!file.name.match(/\.(pdf|docx|doc)$/i)) {
      setError('Please upload a PDF or Word document.');
      return;
    }

    setError(null);
    setFileName(file.name);
    setPhase('extracting');
    setStartTime(Date.now());
    setElapsed(0);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((res, rej) => {
        reader.onload = () => res((reader.result as string).split(',')[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      const extractRes = await fetch('/api/bidcheck/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileBase64: base64 }),
      });
      const { text } = await extractRes.json();

      if (!text || text.length < 100) {
        setError('Could not extract text from document. Please try a different file.');
        setPhase('upload');
        return;
      }

      const chunks: string[] = [];
      for (let pos = 0; pos < text.length; pos += CHUNK_SIZE - CHUNK_OVERLAP) {
        chunks.push(text.substring(pos, pos + CHUNK_SIZE));
        if (pos + CHUNK_SIZE >= text.length) break;
      }
      const chunkCount = chunks.length;
      setExtractProgress({ found: 0, chunk: 0, total: chunkCount });

      const allExtracted: Question[] = [];
      const seenNumbers = new Set<string>();
      let chunksCompleted = 0;

      const scoreQueue: Question[] = [];
      let activeScoring = 0;
      const SCORE_CONCURRENCY = 3;
      const EXTRACT_CONCURRENCY = 3;
      let totalScored = 0;

      const scoredMap = new Map<string, Question>();

      const updateQuestionsState = () => {
        const all = allExtracted.map(q => scoredMap.get(q.id) || q);
        setQuestions([...all]);
      };

      const scoreOne = async (q: Question) => {
        activeScoring++;
        scoredMap.set(q.id, { ...q, status: 'scoring' });
        updateQuestionsState();

        try {
          const res = await fetch('/api/bidcheck/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question_id: q.id,
              question_number: q.question_number,
              question_text: q.question_text,
              answer_text: q.answer_text,
              section: q.section,
              word_limit: q.word_limit,
              weighting: q.weighting,
            }),
          });
          const result = await res.json();

          scoredMap.set(q.id, {
            ...q,
            score: result.score ?? 0,
            mustFix: result.mustFix,
            shouldFix: result.shouldFix,
            niceToHave: result.niceToHave,
            strengths: result.strengths,
            compliance: result.compliance,
            primaryGap: result.primaryGap,
            scorePotential: result.scorePotential,
            status: 'done',
          });
        } catch {
          scoredMap.set(q.id, { ...q, score: 0, status: 'done' });
        }

        activeScoring--;
        totalScored++;
        setScoreProgress({ current: totalScored, total: allExtracted.length });
        updateQuestionsState();
        drainScoreQueue();
      };

      const drainScoreQueue = () => {
        while (scoreQueue.length > 0 && activeScoring < SCORE_CONCURRENCY) {
          const next = scoreQueue.shift()!;
          scoreOne(next);
        }
      };

      const enqueueForScoring = (newQuestions: Question[]) => {
        scoreQueue.push(...newQuestions);
        drainScoreQueue();
      };

      const extractChunk = async (chunkText: string, chunkIdx: number) => {
        try {
          const res = await fetch('/api/bidcheck/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: chunkText, chunkIndex: chunkIdx, existingNumbers: [] }),
          });
          const data = await res.json();
          return (data.pairs || []) as any[];
        } catch {
          return [];
        }
      };

      const processExtractResult = (pairs: any[], chunkIdx: number) => {
        const newQuestions: Question[] = [];

        for (const p of pairs) {
          const num = String(p.question_number);
          if (seenNumbers.has(num)) {
            const existing = allExtracted.find(q => q.question_number === num);
            if (existing && (p.answer_text || '').length > existing.answer_text.length) {
              existing.answer_text = p.answer_text || '';
              existing.question_text = p.question_text || existing.question_text;
              const scored = scoredMap.get(existing.id);
              if (scored && scored.status === 'done') {
                scoredMap.delete(existing.id);
                totalScored--;
                enqueueForScoring([existing]);
              }
            }
            continue;
          }

          seenNumbers.add(num);
          const q: Question = {
            id: 'q-' + chunkIdx + '-' + newQuestions.length + '-' + Date.now(),
            question_number: num,
            question_text: p.question_text || '',
            answer_text: p.answer_text || '',
            section: p.section || 'General',
            word_limit: p.word_limit || null,
            weighting: p.weighting || null,
            status: 'pending',
          };
          newQuestions.push(q);
          allExtracted.push(q);
        }

        chunksCompleted++;
        setExtractProgress({ found: allExtracted.length, chunk: chunksCompleted, total: chunkCount });
        setScoreProgress({ current: totalScored, total: allExtracted.length });
        updateQuestionsState();

        if (newQuestions.length > 0) {
          enqueueForScoring(newQuestions);
        }
      };

      setPhase('scoring');
      setScoreProgress({ current: 0, total: 0 });

      for (let i = 0; i < chunks.length; i += EXTRACT_CONCURRENCY) {
        const batch = chunks.slice(i, Math.min(i + EXTRACT_CONCURRENCY, chunks.length));
        const results = await Promise.all(
          batch.map((chunk, batchIdx) => extractChunk(chunk, i + batchIdx))
        );
        results.forEach((pairs, batchIdx) => processExtractResult(pairs, i + batchIdx));
      }

      if (allExtracted.length === 0) {
        setError('No question-answer pairs found. Make sure you are uploading a completed bid response.');
        setPhase('upload');
        return;
      }

      await new Promise<void>(resolve => {
        const check = () => {
          const allDone = allExtracted.every(q => {
            const s = scoredMap.get(q.id);
            return s && s.status === 'done';
          });
          if (allDone && scoreQueue.length === 0) {
            resolve();
          } else {
            setTimeout(check, 200);
          }
        };
        check();
      });

      setPhase('results');

    } catch (err: any) {
      console.error(err);
      setError('Something went wrong. Please try again.');
      setPhase('upload');
    }
  }

  // ─── COMPUTED ────────────────────────────────────────────────────────────────

  const doneQuestions = questions.filter(q => q.status === 'done' && q.score !== undefined);
  const avgScore = doneQuestions.length > 0
    ? doneQuestions.reduce((s, q) => s + (q.score ?? 0), 0) / doneQuestions.length
    : 0;
  const clearCount = doneQuestions.filter(q => (q.score ?? 0) >= 8).length;
  const reviewCount = doneQuestions.filter(q => (q.score ?? 0) >= 7 && (q.score ?? 0) < 8).length;
  const fixCount = doneQuestions.filter(q => (q.score ?? 0) < 7 && (q.score ?? 0) > 0).length;
  const gatePass = avgScore >= 7.5 && fixCount === 0;
  const recoverableMarks = doneQuestions
    .filter(q => (q.score ?? 0) < 8 && (q.score ?? 0) > 0)
    .reduce((s, q) => s + (8.5 - (q.score ?? 0)), 0);

  const filteredQuestions = questions.filter(q => {
    if (filter === 'fix') return (q.score ?? 10) < 7;
    if (filter === 'clear') return (q.score ?? 0) >= 8;
    return true;
  });

  const sortedQuestions = [...filteredQuestions].sort((a, b) => {
    if (a.status !== 'done' && b.status !== 'done') return 0;
    if (a.status !== 'done') return 1;
    if (b.status !== 'done') return -1;
    return (a.score ?? 10) - (b.score ?? 10);
  });

  // ─── UPLOAD PHASE ────────────────────────────────────────────────────────────

  if (phase === 'upload') {
    return (
      <div className="min-h-screen bg-[#0a0a0a]" style={{ color: '#e2e8f0' }}>
        <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => router.push('/v/' + clientId)} className="p-2 hover:bg-white/10 rounded-lg">
                <ArrowLeft size={20} className="text-gray-400" />
              </button>
              <Image src="/bidcheck-logo.svg" alt="BidCheck" width={40} height={40} />
              <div>
                <h1 className="text-xl font-bold text-white">BidCheck</h1>
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-mono">Pre-Submission Gate</p>
              </div>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-6 py-16 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full font-mono text-[0.7rem] font-semibold tracking-wider uppercase mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Pre-Submission Gate
            </div>

            <h1 className="text-4xl font-black text-white mb-4 leading-tight">
              Upload your completed<br />
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">bid response.</span>
            </h1>
            <p className="text-gray-400 text-lg mb-12">
              BidCheck scores every answer the way the panel will.<br />
              Fix the gaps before they read it.
            </p>

            {error && (
              <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm font-mono text-left">
                ⚠ {error}
              </div>
            )}

            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={'relative border-2 border-dashed rounded-2xl p-14 transition-all cursor-pointer ' + (
                isDragging
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-white/15 hover:border-white/30 bg-white/[0.02]'
              )}
            >
              <input type="file" accept=".pdf,.docx,.doc" onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <CheckCircle size={48} className={'mx-auto mb-4 ' + (isDragging ? 'text-emerald-400' : 'text-gray-600')} />
              <p className="text-lg font-semibold text-white mb-2">
                {isDragging ? 'Drop your completed response here' : 'Drop your completed bid response'}
              </p>
              <p className="text-sm text-gray-500 mb-6">PDF, DOCX — the final draft before submission</p>
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #00e07a, #00b4d8)' }}>
                Choose file
              </div>
              <p className="text-amber-400/70 text-xs mt-5 font-mono">
                🔒 Private. Secure. Not stored. Used once for analysis.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 justify-center mt-8">
              {['Scores like a real evaluator', 'Every gap explained', 'Recoverable marks identified', 'Export full report'].map(t => (
                <span key={t} className="flex items-center gap-1.5 text-[0.78rem] text-gray-500 font-mono">
                  <span className="text-emerald-400">✓</span>{t}
                </span>
              ))}
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  // ─── SCORING PHASE (extraction + scoring run concurrently) ──────────────────

  if (phase === 'extracting' || phase === 'scoring') {
    const scoredQs = questions.filter(q => q.status === 'done');
    const totalQs = questions.length;
    const currentAvg = scoredQs.length > 0
      ? scoredQs.reduce((s, q) => s + (q.score ?? 0), 0) / scoredQs.length
      : 0;
    const stillExtracting = extractProgress.chunk < extractProgress.total;
    const pct = totalQs > 0 ? (scoredQs.length / totalQs) * 100 : 0;

    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-lg px-6 w-full">

          <div className="mb-8 flex justify-center">
            {scoredQs.length === 0 ? (
              <PulsingSpinner size={88} />
            ) : (
              <div className="relative">
                <motion.div
                  className="absolute -inset-3 rounded-full border border-emerald-500/20"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <ScoreRing score={currentAvg} size={88} />
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            {stillExtracting ? 'Reading & scoring your bid' : 'Evaluating your bid'}
          </h2>

          <div className="flex items-center justify-center gap-2 mb-8">
            <motion.span
              className="w-2 h-2 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <p className="text-gray-500 font-mono text-sm">
              {stillExtracting && (
                <span className="text-emerald-400">{extractProgress.found} found · </span>
              )}
              {scoredQs.length} of {totalQs} scored
              <span className="text-gray-600 ml-2">· {formatTime(elapsed)}</span>
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
            {stillExtracting && (
              <div className="mb-4">
                <div className="flex justify-between font-mono text-[10px] text-gray-500 mb-2">
                  <span>Extracting · section {extractProgress.chunk}/{extractProgress.total}</span>
                  <span className="text-emerald-400">{extractProgress.found} questions</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-emerald-500 rounded-full"
                    animate={{ width: (extractProgress.chunk / extractProgress.total) * 100 + '%' }}
                    transition={{ duration: 0.5 }} />
                </div>
              </div>
            )}

            <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-4">
              <motion.div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
                animate={{ width: pct + '%' }} transition={{ duration: 0.4 }} />
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {questions.map((q, i) => {
                const s = q.score ?? 0;
                const bg = q.status === 'done'
                  ? s >= 8 ? 'bg-emerald-500/25 text-emerald-400 border-emerald-500/40'
                  : s >= 7 ? 'bg-amber-500/25 text-amber-400 border-amber-500/40'
                  : 'bg-red-500/25 text-red-400 border-red-500/40'
                  : q.status === 'scoring'
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 animate-pulse'
                  : 'bg-white/5 text-gray-600 border-white/10';

                return (
                  <motion.div key={q.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={'w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold border ' + bg}>
                    {q.status === 'done' ? s.toFixed(0) : q.status === 'scoring' ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : i + 1}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {scoredQs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-3 gap-4 text-center"
            >
              <div>
                <p className="text-xs text-gray-500 font-mono mb-1">Avg Score</p>
                <p className={'text-xl font-bold font-mono ' + getScoreColor(currentAvg)}>{currentAvg.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-mono mb-1">Clear</p>
                <p className="text-xl font-bold font-mono text-emerald-400">
                  {scoredQs.filter(q => (q.score ?? 0) >= 8).length}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-mono mb-1">Needs Fix</p>
                <p className="text-xl font-bold font-mono text-red-400">
                  {scoredQs.filter(q => (q.score ?? 0) < 7 && (q.score ?? 0) > 0).length}
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  // ─── RESULTS PHASE ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0a]" style={{ color: '#e2e8f0' }}>
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => { setPhase('upload'); setQuestions([]); setFileName(''); }}
              className="p-2 hover:bg-white/10 rounded-lg">
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <Image src="/bidcheck-logo.svg" alt="BidCheck" width={40} height={40} />
            <div>
              <h1 className="text-xl font-bold text-white">BidCheck</h1>
              <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-mono">Pre-Submission Gate</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportReport}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-mono hover:bg-emerald-500/25 transition-colors">
              <Download size={14} /> Export Report
            </button>
            <button onClick={() => { setPhase('upload'); setQuestions([]); setFileName(''); }}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-gray-400 rounded-lg text-sm hover:bg-white/10 transition-colors">
              <RotateCw size={14} /> New Check
            </button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        <div className="flex items-start justify-between mb-8 gap-6">
          <div>
            <p className="font-mono text-xs text-gray-500 mb-2 uppercase tracking-wider">
              BidCheck · {fileName}
            </p>
            <h2 className="text-3xl font-black text-white mb-2">Pre-Submission Gate</h2>
            <p className="text-gray-400 text-sm font-mono">
              {doneQuestions.length} questions evaluated · {formatTime(elapsed)} · Scored the way the panel scores it
            </p>
          </div>

          <div className="flex items-center gap-5 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 flex-shrink-0">
            <ScoreRing score={avgScore} size={80} />
            <div>
              <div className={'text-lg font-bold mb-1 ' + (gatePass ? 'text-emerald-400' : 'text-amber-400')}>
                {gatePass ? '✓ Gate Clear' : '⚠ Review Required'}
              </div>
              <div className="font-mono text-xs text-gray-500 mb-3">
                {doneQuestions.length} QUESTIONS · AVG {avgScore.toFixed(1)}/10
              </div>
              <button
                className={'px-4 py-2 rounded-lg text-sm font-bold transition-all ' + (
                  gatePass
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90'
                    : 'bg-white/10 text-gray-400 cursor-default'
                )}
              >
                {gatePass ? '✓ Approve Submission' : 'Fix ' + fixCount + ' issues first'}
              </button>
            </div>
          </div>
        </div>

        <div className={'flex items-center gap-4 px-5 py-4 rounded-xl border mb-6 ' + (
          gatePass
            ? 'bg-emerald-500/05 border-emerald-500/20'
            : 'bg-amber-500/05 border-amber-500/20'
        )}>
          <div className="text-2xl">{gatePass ? '✓' : '⚠'}</div>
          <div className="flex-1">
            <div className={'font-bold text-sm mb-1 ' + (gatePass ? 'text-emerald-400' : 'text-amber-400')}>
              {gatePass
                ? 'Submission-ready — strong bid averaging ' + avgScore.toFixed(1) + '/10'
                : (fixCount + reviewCount) + ' answer' + (fixCount + reviewCount !== 1 ? 's' : '') + ' need attention before submission'}
            </div>
            <div className="font-mono text-xs text-gray-500">
              {clearCount} clear · {reviewCount} review · {fixCount} fix required · {recoverableMarks.toFixed(1)} marks recoverable
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Gate Status', value: gatePass ? 'PASS' : 'REVIEW', color: gatePass ? 'text-emerald-400' : 'text-amber-400' },
            { label: 'Avg Score', value: avgScore.toFixed(1), color: getScoreColor(avgScore) },
            { label: 'Clear (8+)', value: String(clearCount), color: 'text-emerald-400' },
            { label: 'Needs Fix', value: String(fixCount), color: fixCount > 0 ? 'text-red-400' : 'text-gray-500' },
            { label: 'Recoverable', value: '+' + recoverableMarks.toFixed(1), color: 'text-cyan-400' },
          ].map(s => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="font-mono text-[9px] text-gray-500 uppercase tracking-wider mb-2">{s.label}</p>
              <p className={'font-mono text-2xl font-bold ' + s.color}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_300px] gap-6 items-start">

          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="font-mono text-xs text-gray-500 uppercase tracking-wider">Question Assessment</p>
              <div className="flex gap-2">
                {[
                  { key: 'all', label: 'All ' + questions.length },
                  { key: 'fix', label: '⚠ Fix ' + (fixCount + reviewCount) },
                  { key: 'clear', label: '✓ Clear ' + clearCount },
                ].map(f => (
                  <button key={f.key} onClick={() => setFilter(f.key as any)}
                    className={'px-3 py-1.5 rounded-lg font-mono text-[10px] border transition-all ' + (
                      filter === f.key
                        ? 'bg-purple-500/15 border-purple-500/40 text-purple-400'
                        : 'border-white/10 text-gray-500 hover:text-gray-400'
                    )}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {sortedQuestions.map(q => {
                const gate = q.status === 'done' ? getGateLabel(q.score ?? 0) : null;
                const isExpanded = expandedId === q.id;

                return (
                  <div key={q.id}>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => setExpandedId(isExpanded ? null : q.id)}
                      className={'flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all hover:border-white/20 ' +
                        (isExpanded ? 'border-purple-500/30 bg-purple-500/05' : 'border-white/08 bg-white/[0.03]') +
                        ((q.score ?? 10) < 7 && q.status === 'done' ? ' border-l-2 border-l-red-500/60' : '')}
                      style={{ borderLeftColor: q.status === 'done' && (q.score ?? 10) < 7 ? '#ff4560' : undefined }}
                    >
                      <div className={'w-12 h-12 rounded-xl flex flex-col items-center justify-center border flex-shrink-0 font-mono ' +
                        (q.status === 'done' ? getScoreBg(q.score ?? 0) : 'bg-white/5 border-white/10')
                      }>
                        {q.status === 'done' ? (
                          <>
                            <span className={'text-sm font-bold leading-none ' + getScoreColor(q.score ?? 0)}>
                              {(q.score ?? 0).toFixed(1)}
                            </span>
                            <span className="text-[8px] text-gray-600 mt-0.5">/10</span>
                          </>
                        ) : q.status === 'scoring' ? (
                          <Loader2 size={16} className="text-cyan-400 animate-spin" />
                        ) : (
                          <span className="text-xs text-gray-600">{q.question_number}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {q.question_text.length > 80 ? q.question_text.substring(0, 80) + '…' : q.question_text}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {gate && (
                            <span className={'text-[9px] font-bold font-mono px-1.5 py-0.5 rounded border ' + gate.bg + ' ' + gate.color}>
                              {gate.label}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-600 font-mono">
                            Q{q.question_number} · {q.section}
                          </span>
                          {q.primaryGap && (
                            <span className="text-[10px] text-red-400 font-mono truncate">
                              {q.primaryGap}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {q.scorePotential && (q.score ?? 10) < 8 && (
                          <span className="text-[9px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded hidden sm:block">
                            ↑ recoverable
                          </span>
                        )}
                        {isExpanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                      </div>
                    </motion.div>

                    <AnimatePresence>
                      {isExpanded && q.status === 'done' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mx-2 mb-2 bg-white/[0.04] border border-purple-500/20 rounded-xl overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-white/08 bg-purple-500/05">
                              <div className="flex-1 min-w-0 mr-4">
                                <p className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">Q{q.question_number} · {q.section}</p>
                                <p className="text-sm text-white font-medium">{q.question_text}</p>
                              </div>
                              <span className={'font-mono text-2xl font-bold flex-shrink-0 ' + getScoreColor(q.score ?? 0)}>
                                {(q.score ?? 0).toFixed(1)}
                              </span>
                            </div>

                            {/* Bidder's answer */}
                            <div className="px-5 pt-4 pb-2 border-b border-white/06">
                              <p className="font-mono text-[9px] text-gray-500 uppercase tracking-wider mb-2">📝 Bidder's Answer</p>
                              <div className="text-xs text-gray-400 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto pr-2 scrollbar-thin">{q.answer_text}</div>
                            </div>

                            <div className="p-5 grid grid-cols-2 gap-5">
                              {q.primaryGap && (
                                <div className="col-span-2">
                                  <p className="font-mono text-[9px] text-red-400 uppercase tracking-wider mb-2">🔴 Primary reason for lost marks</p>
                                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg font-mono text-xs text-red-400">
                                    {q.primaryGap}
                                  </div>
                                </div>
                              )}

                              {q.mustFix && (
                                <div>
                                  <p className="font-mono text-[9px] text-red-400 uppercase tracking-wider mb-2">Must Fix</p>
                                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{q.mustFix}</p>
                                </div>
                              )}

                              {q.shouldFix && (
                                <div>
                                  <p className="font-mono text-[9px] text-amber-400 uppercase tracking-wider mb-2">Should Fix</p>
                                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{q.shouldFix}</p>
                                </div>
                              )}

                              {q.niceToHave && (
                                <div className="col-span-2">
                                  <p className="font-mono text-[9px] text-blue-400 uppercase tracking-wider mb-2">Could Fix</p>
                                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{q.niceToHave}</p>
                                </div>
                              )}

                              {q.scorePotential && (
                                <div className="col-span-2 flex items-start gap-3 p-3 bg-emerald-500/05 border border-emerald-500/15 rounded-lg">
                                  <span className="text-emerald-400 text-sm mt-0.5">↑</span>
                                  <p className="text-xs text-emerald-300 leading-relaxed">{q.scorePotential}</p>
                                </div>
                              )}

                              {q.strengths && q.strengths.length > 0 && (
                                <div className="col-span-2">
                                  <p className="font-mono text-[9px] text-emerald-400 uppercase tracking-wider mb-2">✓ What was done well</p>
                                  <div className="space-y-1.5">
                                    {q.strengths.map((s, idx) => (
                                      <div key={idx} className="flex items-start gap-2">
                                        <span className="text-emerald-400 text-xs mt-0.5">✓</span>
                                        <p className="text-xs text-gray-300">{s}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {q.compliance && q.compliance.length > 0 && (
                                <div className="col-span-2">
                                  <p className="font-mono text-[9px] text-purple-400 uppercase tracking-wider mb-2">📋 Compliance Check</p>
                                  <div className="space-y-1.5">
                                    {q.compliance.map((c, idx) => (
                                      <div key={idx} className="flex items-start gap-2">
                                        <p className="text-xs text-gray-300">{c}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">

            <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/08 bg-white/[0.02]">
                <p className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">🔒 Submission Gate</p>
              </div>
              <div className="p-4 space-y-2.5">
                {[
                  { label: 'Score Threshold', sub: avgScore.toFixed(1) + ' avg · target 7.5', pass: avgScore >= 7.5 },
                  { label: 'All Questions', sub: doneQuestions.length + ' of ' + questions.length + ' answered', pass: doneQuestions.length === questions.length },
                  { label: 'Critical Gaps', sub: fixCount === 0 ? 'None detected' : fixCount + ' below 7.0', pass: fixCount === 0 },
                  { label: 'Review Items', sub: reviewCount === 0 ? 'None' : reviewCount + ' between 7–8', pass: reviewCount === 0 },
                ].map(item => (
                  <div key={item.label} className={'flex items-center gap-3 p-2.5 rounded-lg border ' + (
                    item.pass ? 'bg-emerald-500/04 border-emerald-500/15' : 'bg-amber-500/04 border-amber-500/15'
                  )}>
                    <div className={'w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ' + (
                      item.pass ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                    )}>
                      {item.pass ? '✓' : '!'}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{item.label}</p>
                      <p className="font-mono text-[10px] text-gray-500">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-white/08 bg-white/[0.02]">
                <p className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">📊 Score Distribution</p>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: 'Excellent 9+', count: doneQuestions.filter(q => (q.score ?? 0) >= 9).length, color: '#00e07a', max: doneQuestions.length },
                  { label: 'Strong 8–8.9', count: doneQuestions.filter(q => (q.score ?? 0) >= 8 && (q.score ?? 0) < 9).length, color: '#34d399', max: doneQuestions.length },
                  { label: 'Good 7–7.9', count: reviewCount, color: '#ffb020', max: doneQuestions.length },
                  { label: 'Gap 6–6.9', count: doneQuestions.filter(q => (q.score ?? 0) >= 6 && (q.score ?? 0) < 7).length, color: '#ff4560', max: doneQuestions.length },
                  { label: 'Weak <6', count: doneQuestions.filter(q => (q.score ?? 0) > 0 && (q.score ?? 0) < 6).length, color: '#ff4560', max: doneQuestions.length },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2">
                    <p className="font-mono text-[10px] text-gray-500 w-24 flex-shrink-0">{row.label}</p>
                    <div className="flex-1 h-1.5 bg-white/06 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: (row.max > 0 ? (row.count / row.max) * 100 : 0) + '%', background: row.color }} />
                    </div>
                    <p className="font-mono text-xs font-bold w-5 text-right" style={{ color: row.count > 0 ? row.color : '#374151' }}>
                      {row.count}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-cyan-500/04 border border-cyan-500/15 rounded-xl p-4">
              <p className="font-mono text-[9px] text-cyan-400 uppercase tracking-wider mb-3">↑ Recovery Potential</p>
              <p className="font-mono text-3xl font-bold text-cyan-400 mb-1">+{recoverableMarks.toFixed(1)}</p>
              <p className="font-mono text-[10px] text-gray-500 mb-4">marks available if gaps fixed</p>
              <div className="mt-3 space-y-1.5">
                {doneQuestions
                  .filter(q => (q.score ?? 0) < 8 && (q.score ?? 0) > 0)
                  .slice(0, 5)
                  .map(q => (
                    <div key={q.id} className="flex items-center justify-between font-mono text-[10px] text-gray-500">
                      <span className="truncate">Q{q.question_number} {q.primaryGap ? '· ' + q.primaryGap : ''}</span>
                      <span className="text-cyan-400 flex-shrink-0 ml-2">+{(8.5 - (q.score ?? 0)).toFixed(1)}</span>
                    </div>
                  ))}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
