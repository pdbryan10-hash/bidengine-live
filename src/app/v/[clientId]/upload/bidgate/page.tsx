'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Upload, FileText, CheckCircle, AlertCircle,
  Loader2, X, File, FileSpreadsheet, Shield, HelpCircle, Info
} from 'lucide-react';
import Image from 'next/image';
import { UserButton } from '@clerk/nextjs';

interface UploadedFile {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

export default function BidGateUploadPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [tenderName, setTenderName] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerOrgType, setBuyerOrgType] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const ext = file.name.toLowerCase();
      return ext.endsWith('.pdf') || ext.endsWith('.docx') || ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.doc');
    });

    const uploadedFiles: UploadedFile[] = validFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...uploadedFiles]);

    if (!tenderName && validFiles.length > 0) {
      const name = validFiles[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setTenderName(name);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase();
    if (ext.endsWith('.pdf')) return <FileText className="text-red-400" size={24} />;
    if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) return <FileSpreadsheet className="text-green-400" size={24} />;
    if (ext.endsWith('.docx') || ext.endsWith('.doc')) return <FileText className="text-blue-400" size={24} />;
    return <File className="text-gray-400" size={24} />;
  };

  const handleSubmit = async () => {
    if (files.length === 0 || !tenderName.trim()) return;

    setIsProcessing(true);

    try {
      // Process first file (main ITT)
      const mainFile = files[0];
      
      setFiles(prev => prev.map((f, idx) => 
        idx === 0 ? { ...f, status: 'uploading', progress: 30 } : f
      ));

      const formData = new FormData();
      formData.append('file', mainFile.file);
      formData.append('clientId', clientId);
      formData.append('tenderName', tenderName);
      if (buyerName.trim()) formData.append('buyerName', buyerName.trim());
      if (buyerOrgType) formData.append('buyerOrgType', buyerOrgType);

      setFiles(prev => prev.map((f, idx) => 
        idx === 0 ? { ...f, progress: 60 } : f
      ));

      const response = await fetch('/api/bidgate/analyse', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      // Mark all files as success
      setFiles(prev => prev.map(f => ({ ...f, status: 'success', progress: 100 })));

      // Store full result in sessionStorage for the results page
      sessionStorage.setItem('bidgate_result', JSON.stringify({
        analysis: result.analysis,
        tender_name: result.tender_name || tenderName,
        evidence_counts: result.evidence_counts,
        total_evidence: result.total_evidence,
        bidlearn: result.bidlearn || null,
        buyer_name: result.buyer_name || null,
        buyer_org_type: result.buyer_org_type || null,
      }));

      await new Promise(r => setTimeout(r, 500));
      router.push(`/v/${clientId}/bidgate?tender=${encodeURIComponent(tenderName)}`);

    } catch (error) {
      console.error('Analysis error:', error);
      setFiles(prev => prev.map(f => ({ 
        ...f, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Analysis failed' 
      })));
      setIsProcessing(false);
    }
  };

  const allComplete = files.length > 0 && files.every(f => f.status === 'success');
  const canSubmit = files.length > 0 && tenderName.trim() && !isProcessing;

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push(`/v/${clientId}/upload`)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-400" />
            </button>
            <div className="flex items-center gap-3">
              <Image src="/bidgate-logo.svg" alt="BidGate" width={50} height={50} />
              <div>
                <h1 className="text-xl font-bold text-white">BidGate</h1>
                <p className="text-[10px] text-amber-400 uppercase tracking-wider">Go/No-Go Analysis</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <a href="https://hello.bidengine.co" target="_blank" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm">
              <Info size={16} />
              About
            </a>
            <a href="https://docs.bidengine.co" target="_blank" className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm">
              <HelpCircle size={16} />
              Help
            </a>
            <button
              onClick={() => router.push(`/v/${clientId}`)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={18} />
              Dashboard
            </button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl"
        >
          <div className="flex items-start gap-3">
            <Shield className="text-amber-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-amber-400 font-medium mb-1">Pre-Bid Intelligence</p>
              <p className="text-sm text-gray-400">
                BidGate analyses tender documents against your BidVault evidence to assess bid readiness. 
                It identifies gaps, risks, and compliance requirements to support Go/No-Go decisions.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tender Name */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-2">Opportunity Name</label>
          <input
            type="text"
            value={tenderName}
            onChange={e => setTenderName(e.target.value)}
            placeholder="Enter tender or opportunity name..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 transition-colors text-lg text-white"
          />
        </motion.div>

        {/* Buyer Info */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mb-8 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Contracting Authority <span className="text-gray-600">(optional)</span></label>
            <input
              type="text"
              value={buyerName}
              onChange={e => setBuyerName(e.target.value)}
              placeholder="e.g. Birmingham City Council"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 transition-colors text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Buyer Type <span className="text-gray-600">(optional)</span></label>
            <select
              value={buyerOrgType}
              onChange={e => setBuyerOrgType(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 transition-colors text-white"
            >
              <option value="">Select type...</option>
              <option value="Local Authority">Local Authority</option>
              <option value="NHS">NHS</option>
              <option value="Central Government">Central Government</option>
              <option value="Housing Association">Housing Association</option>
              <option value="Education">Education</option>
              <option value="Police/Fire">Police / Fire</option>
              <option value="Other Public Sector">Other Public Sector</option>
            </select>
          </div>
        </motion.div>

        {/* Upload Area */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-2">Tender Documents</label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
              isDragging ? 'border-amber-500 bg-amber-500/10' : 'border-white/20 hover:border-white/40 bg-white/[0.02]'
            }`}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.xlsx,.xls"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />
            <Shield size={48} className={`mx-auto mb-4 ${isDragging ? 'text-amber-400' : 'text-gray-500'}`} />
            <p className="text-lg text-white mb-2">{isDragging ? 'Drop files here' : 'Drag & drop tender documents'}</p>
            <p className="text-sm text-gray-500">or click to browse • PDF, Word, Excel</p>
            <p className="text-xs text-gray-600 mt-2">ITT, SQ, pricing schedules, appendices, evaluation criteria...</p>
          </div>
        </motion.div>

        {/* Files List */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-8 space-y-3">
              <label className="block text-sm font-medium text-gray-400 mb-2">Selected Files ({files.length})</label>
              {files.map((uploadedFile, index) => (
                <motion.div key={index} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                  {getFileIcon(uploadedFile.file.name)}
                  <div className="flex-1 min-w-0">
                    <p className="text-white truncate">{uploadedFile.file.name}</p>
                    <p className="text-xs text-gray-500">{(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB</p>
                    {uploadedFile.status === 'uploading' && (
                      <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${uploadedFile.progress}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {uploadedFile.status === 'pending' && !isProcessing && (
                      <button onClick={() => removeFile(index)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <X size={18} className="text-gray-400" />
                      </button>
                    )}
                    {uploadedFile.status === 'uploading' && <Loader2 size={20} className="text-amber-400 animate-spin" />}
                    {uploadedFile.status === 'success' && <CheckCircle size={20} className="text-emerald-400" />}
                    {uploadedFile.status === 'error' && <AlertCircle size={20} className="text-red-400" />}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit Button */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
              canSubmit ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90' : 'bg-white/10 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2"><Loader2 size={20} className="animate-spin" />Analysing Tender...</span>
            ) : allComplete ? (
              <span className="flex items-center justify-center gap-2"><CheckCircle size={20} />Complete - Opening Analysis...</span>
            ) : (
              'Analyse Tender'
            )}
          </button>
        </motion.div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Upload all relevant tender documents including ITT, pricing schedules, and evaluation criteria.<br />
          BidGate will assess your bid readiness against your BidVault evidence.
        </p>
      </main>
    </div>
  );
}
