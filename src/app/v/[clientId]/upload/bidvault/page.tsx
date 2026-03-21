'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { UserButton } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Upload, FileText, CheckCircle, AlertCircle,
  Loader2, X, Database, HelpCircle, Info,
  PenLine, ChevronDown
} from 'lucide-react';

const CATEGORIES = [
  'FINANCIAL','GOVERNANCE','SOCIAL_VALUE','INNOVATION','QUALITY','SAFETY',
  'SUSTAINABILITY','RESOURCE','CLIENT_FEEDBACK','SUPPLY_CHAIN','PROGRAMME',
  'INCIDENT','CASE_STUDY','KPI','MOBILISATION','OTHER',
];

interface UploadedFile {
  file: File;
  status: 'pending' | 'uploading' | 'extracting' | 'success' | 'error';
  progress: number;
  error?: string;
  recordsCreated?: number;
}

export default function BidVaultUploadPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [mode, setMode] = useState<'upload' | 'manual'>('upload');

  // --- UPLOAD MODE ---
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [documentName, setDocumentName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [processingProgress, setProcessingProgress] = useState<{
    currentFile: number; totalFiles: number; currentFileName: string; status: string; startTime: number;
  } | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (processingProgress?.startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - processingProgress.startTime) / 1000));
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [processingProgress?.startTime]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, []);

  const addFiles = (newFiles: File[]) => {
    const valid = newFiles.filter(f => /\.(pdf|docx|doc)$/i.test(f.name));
    setFiles(prev => [...prev, ...valid.map(f => ({ file: f, status: 'pending' as const, progress: 0 }))]);
    if (!documentName && valid.length > 0) {
      setDocumentName(valid[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    }
  };

  const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index));

  const processFile = async (index: number): Promise<number> => {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'uploading', progress: 30 } : f));
    try {
      const formData = new FormData();
      formData.append('file', files[index].file);
      formData.append('clientId', clientId);
      setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'extracting', progress: 60 } : f));
      const res = await fetch('/api/bidvault/extract', { method: 'POST', body: formData });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || 'Extraction failed');
      setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'success', progress: 100, recordsCreated: result.records_created || 0 } : f));
      return result.records_created || 0;
    } catch (error) {
      setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'error', progress: 0, error: error instanceof Error ? error.message : 'Failed' } : f));
      return 0;
    }
  };

  const handleSubmit = async () => {
    if (!files.length || !documentName.trim()) return;
    setIsProcessing(true); setTotalRecords(0);
    const startTime = Date.now(); setElapsedTime(0);
    let count = 0;
    for (let i = 0; i < files.length; i++) {
      setProcessingProgress({ currentFile: i + 1, totalFiles: files.length, currentFileName: files[i].file.name, status: 'Extracting evidence...', startTime });
      count += await processFile(i);
      setTotalRecords(count);
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }
    setProcessingProgress(null);
    await new Promise(r => setTimeout(r, 1500));
    router.push(`/v/${clientId}/bidvault`);
  };

  // --- MANUAL MODE ---
  const [form, setForm] = useState({ category: 'QUALITY', title: '', value: '', source_text: '', client_name: '', sector: '' });
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSuccess, setManualSuccess] = useState(false);
  const [manualError, setManualError] = useState('');

  const handleManualSubmit = async () => {
    if (!form.title.trim()) return;
    setManualLoading(true); setManualError(''); setManualSuccess(false);
    try {
      const res = await fetch('/api/bidvault/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, ...form }),
      });
      if (!res.ok) throw new Error();
      setManualSuccess(true);
      setForm({ category: 'QUALITY', title: '', value: '', source_text: '', client_name: '', sector: '' });
    } catch {
      setManualError('Failed to save record. Please try again.');
    } finally {
      setManualLoading(false);
    }
  };

  const allComplete = files.length > 0 && files.every(f => f.status === 'success');
  const canSubmit = files.length > 0 && documentName.trim() && !isProcessing;
  const canSaveManual = form.title.trim() && !manualLoading;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push(`/v/${clientId}/upload`)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-xl border border-purple-500/30"><Database className="text-purple-400" size={24} /></div>
              <div>
                <h1 className="text-xl font-bold text-white">BidVault</h1>
                <p className="text-[10px] text-purple-400 uppercase tracking-wider">Add Evidence</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://hello.bidengine.co" target="_blank" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"><Info size={16} />About</a>
            <a href="https://docs.bidengine.co" target="_blank" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm"><HelpCircle size={16} />Help</a>
            <button onClick={() => router.push(`/v/${clientId}`)} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors">
              <ArrowLeft size={18} />Dashboard
            </button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Mode toggle */}
        <div className="flex gap-1 mb-8 bg-white/5 p-1 rounded-xl w-fit border border-white/10">
          <button onClick={() => setMode('upload')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'upload' ? 'bg-purple-500/30 text-white border border-purple-500/40' : 'text-gray-400 hover:text-white'}`}>
            <Upload size={16} />Upload Document
          </button>
          <button onClick={() => setMode('manual')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'manual' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-gray-400 hover:text-white'}`}>
            <PenLine size={16} />Add Manually
          </button>
        </div>

        <AnimatePresence mode="wait">

          {/* UPLOAD MODE */}
          {mode === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-400 mb-2">Document / Project Name</label>
                <input type="text" value={documentName} onChange={e => setDocumentName(e.target.value)}
                  placeholder="Enter document or project name..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 transition-colors text-lg text-white" />
              </div>

              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-400 mb-2">Evidence Documents</label>
                <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${isDragging ? 'border-purple-500 bg-purple-500/10' : 'border-white/20 hover:border-white/40 bg-white/[0.02]'}`}>
                  <input type="file" multiple accept=".pdf,.docx,.doc" onChange={e => e.target.files && addFiles(Array.from(e.target.files))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isProcessing} />
                  <Database size={48} className={`mx-auto mb-4 ${isDragging ? 'text-purple-400' : 'text-gray-500'}`} />
                  <p className="text-lg text-white mb-2">{isDragging ? 'Drop files here' : 'Drag & drop evidence documents'}</p>
                  <p className="text-sm text-gray-500">or click to browse • PDF, Word documents</p>
                  <p className="text-xs text-gray-600 mt-2">Annual reports, case studies, KPI reports, testimonials...</p>
                </div>
              </div>

              <AnimatePresence>
                {files.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-8 space-y-3">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Selected Files ({files.length})</label>
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                        <FileText className={f.file.name.endsWith('.pdf') ? 'text-red-400' : 'text-blue-400'} size={24} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white truncate">{f.file.name}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-500">{(f.file.size / 1024 / 1024).toFixed(2)} MB</p>
                            {f.status === 'extracting' && <span className="text-xs text-purple-400">Extracting...</span>}
                            {f.status === 'success' && f.recordsCreated && <span className="text-xs text-emerald-400">{f.recordsCreated} records</span>}
                            {f.status === 'error' && <span className="text-xs text-red-400">{f.error}</span>}
                          </div>
                          {(f.status === 'uploading' || f.status === 'extracting') && (
                            <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-purple-500 transition-all" style={{ width: `${f.progress}%` }} />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {f.status === 'pending' && !isProcessing && <button onClick={() => removeFile(i)} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} className="text-gray-400" /></button>}
                          {(f.status === 'uploading' || f.status === 'extracting') && <Loader2 size={20} className="text-purple-400 animate-spin" />}
                          {f.status === 'success' && <CheckCircle size={20} className="text-emerald-400" />}
                          {f.status === 'error' && <AlertCircle size={20} className="text-red-400" />}
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {processingProgress && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="mb-8 p-6 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-2xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center"><Database size={20} className="text-purple-400" /></div>
                        <div>
                          <h3 className="text-white font-semibold">Extracting Evidence</h3>
                          <p className="text-sm text-gray-400">File {processingProgress.currentFile} of {processingProgress.totalFiles}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{processingProgress.currentFile}<span className="text-gray-500">/{processingProgress.totalFiles}</span></div>
                        <div className="text-sm text-purple-400 font-mono">⏱️ {formatTime(elapsedTime)}</div>
                      </div>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-4">
                      <motion.div className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full"
                        initial={{ width: 0 }} animate={{ width: `${(processingProgress.currentFile / processingProgress.totalFiles) * 100}%` }} transition={{ duration: 0.5 }} />
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div><p className="text-xs text-gray-500 mb-1">Elapsed</p><p className="text-lg font-mono font-bold text-white">{formatTime(elapsedTime)}</p></div>
                      <div><p className="text-xs text-gray-500 mb-1">Records Found</p><p className="text-lg font-bold text-emerald-400">{totalRecords}</p></div>
                      <div><p className="text-xs text-gray-500 mb-1">Files Done</p><p className="text-lg font-bold text-white">{files.filter(f => f.status === 'success').length}/{processingProgress.totalFiles}</p></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {totalRecords > 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
                  <p className="text-emerald-400 font-semibold">✓ {totalRecords} evidence records extracted and saved to BidVault</p>
                </motion.div>
              )}

              <button onClick={handleSubmit} disabled={!canSubmit}
                className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${canSubmit ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:opacity-90' : 'bg-white/10 text-gray-500 cursor-not-allowed'}`}>
                {isProcessing ? <span className="flex items-center justify-center gap-2"><Loader2 size={20} className="animate-spin" />Extracting Evidence...</span>
                  : allComplete ? <span className="flex items-center justify-center gap-2"><CheckCircle size={20} />Complete — Opening BidVault...</span>
                  : 'Extract Evidence to BidVault'}
              </button>

              <p className="text-center text-sm text-gray-500 mt-6">
                Upload annual reports, case studies, KPI reports, and other evidence documents.<br />
                BidEngine will automatically extract and categorise evidence for your bids.
              </p>
            </motion.div>
          )}

          {/* MANUAL MODE */}
          {mode === 'manual' && (
            <motion.div key="manual" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
              <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <PenLine size={18} className="text-emerald-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-emerald-300">Add a single evidence record directly. Use this for specific KPIs, testimonials, or stats that aren't in a document — or to fix a poorly extracted record.</p>
                </div>
              </div>

              <div className="space-y-5">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Category <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500/50 transition-colors text-white appearance-none cursor-pointer">
                      {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#1a1a1a]">{c.replace('_', ' ')}</option>)}
                    </select>
                    <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Title <span className="text-red-400">*</span></label>
                  <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Zero RIDDOR reportable incidents over 36 months"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500/50 transition-colors text-white" />
                </div>

                {/* Value */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Value / Metric</label>
                  <input type="text" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="e.g. 0 RIDDOR incidents | 99.2% PPM completion | £2.4m contract value"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500/50 transition-colors text-white" />
                  <p className="text-xs text-gray-600 mt-1">The specific number or stat BidWrite will cite. Include units.</p>
                </div>

                {/* Client Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Client Name</label>
                  <input type="text" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                    placeholder="e.g. Midshire County Council"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500/50 transition-colors text-white" />
                </div>

                {/* Sector */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Sector</label>
                  <input type="text" value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
                    placeholder="e.g. Local Government / NHS / Housing / Education"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500/50 transition-colors text-white" />
                </div>

                {/* Source Text */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Source Text / Narrative</label>
                  <textarea value={form.source_text} onChange={e => setForm(f => ({ ...f, source_text: e.target.value }))}
                    placeholder="Full context — what contract, what service, what outcome, over what period. More detail = better retrieval."
                    rows={5}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-emerald-500/50 transition-colors text-white resize-none" />
                  <p className="text-xs text-gray-600 mt-1">This is the text BidWrite reads when writing the response. Be specific.</p>
                </div>

                {manualError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{manualError}</div>
                )}

                {manualSuccess && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
                    <p className="text-emerald-400 font-semibold">✓ Record saved to BidVault</p>
                    <p className="text-gray-500 text-sm mt-1">Embedding generated. The record is now searchable.</p>
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <button onClick={handleManualSubmit} disabled={!canSaveManual}
                    className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-all ${canSaveManual ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:opacity-90' : 'bg-white/10 text-gray-500 cursor-not-allowed'}`}>
                    {manualLoading ? <span className="flex items-center justify-center gap-2"><Loader2 size={20} className="animate-spin" />Saving...</span> : 'Save to BidVault'}
                  </button>
                  <button onClick={() => router.push(`/v/${clientId}/bidvault`)}
                    className="px-6 py-4 bg-white/5 border border-white/10 text-gray-400 font-medium rounded-xl hover:bg-white/10 transition-colors">
                    View Library
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
