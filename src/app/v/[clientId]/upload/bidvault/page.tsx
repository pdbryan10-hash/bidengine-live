'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Upload, FileText, CheckCircle, AlertCircle,
  Loader2, X, File, FileSpreadsheet, Database, HelpCircle, Info, Timer
} from 'lucide-react';
import Image from 'next/image';
import { UserButton } from '@clerk/nextjs';

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

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [documentName, setDocumentName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Processing progress
  const [processingProgress, setProcessingProgress] = useState<{
    currentFile: number;
    totalFiles: number;
    currentFileName: string;
    status: string;
    startTime: number;
  } | null>(null);
  
  // Elapsed time
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Update elapsed time every second while processing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (processingProgress?.startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - processingProgress.startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [processingProgress?.startTime]);
  
  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      return ext.endsWith('.pdf') || ext.endsWith('.docx') || ext.endsWith('.doc');
    });

    const uploadedFiles: UploadedFile[] = validFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...uploadedFiles]);

    if (!documentName && validFiles.length > 0) {
      const name = validFiles[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setDocumentName(name);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase();
    if (ext.endsWith('.pdf')) return <FileText className="text-red-400" size={24} />;
    if (ext.endsWith('.docx') || ext.endsWith('.doc')) return <FileText className="text-blue-400" size={24} />;
    return <File className="text-gray-400" size={24} />;
  };

  const processFile = async (index: number): Promise<number> => {
    const uploadedFile = files[index];
    
    setFiles(prev => prev.map((f, idx) => 
      idx === index ? { ...f, status: 'uploading', progress: 30 } : f
    ));

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile.file);
      formData.append('clientId', clientId);

      setFiles(prev => prev.map((f, idx) => 
        idx === index ? { ...f, status: 'extracting', progress: 60 } : f
      ));

      const response = await fetch('/api/bidvault/extract', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || 'Extraction failed');
      }

      setFiles(prev => prev.map((f, idx) => 
        idx === index ? { 
          ...f, 
          status: 'success', 
          progress: 100,
          recordsCreated: result.records_created || 0
        } : f
      ));

      return result.records_created || 0;

    } catch (error) {
      console.error('File processing error:', error);
      setFiles(prev => prev.map((f, idx) => 
        idx === index ? { 
          ...f, 
          status: 'error', 
          progress: 0,
          error: error instanceof Error ? error.message : 'Processing failed'
        } : f
      ));
      return 0;
    }
  };

  const handleSubmit = async () => {
    if (files.length === 0 || !documentName.trim()) return;

    setIsProcessing(true);
    setTotalRecords(0);
    const startTime = Date.now();
    setElapsedTime(0);

    let recordCount = 0;

    for (let i = 0; i < files.length; i++) {
      // Update progress
      setProcessingProgress({
        currentFile: i + 1,
        totalFiles: files.length,
        currentFileName: files[i].file.name,
        status: 'Extracting evidence...',
        startTime
      });
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      
      const records = await processFile(i);
      recordCount += records;
      setTotalRecords(recordCount);
      
      // Update elapsed time after each file
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }
    
    // Clear progress
    setProcessingProgress(null);

    await new Promise(r => setTimeout(r, 1500));
    router.push(`/v/${clientId}/bidvault`);
  };

  const allComplete = files.length > 0 && files.every(f => f.status === 'success');
  const canSubmit = files.length > 0 && documentName.trim() && !isProcessing;

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
              <Image src="/bidvault-logo.svg" alt="BidVault" width={50} height={50} />
              <div>
                <h1 className="text-xl font-bold text-white">BidVault</h1>
                <p className="text-[10px] text-purple-400 uppercase tracking-wider">Upload Evidence</p>
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
        {/* Document Name */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-2">Document / Project Name</label>
          <input
            type="text"
            value={documentName}
            onChange={e => setDocumentName(e.target.value)}
            placeholder="Enter document or project name..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500/50 transition-colors text-lg text-white"
          />
        </motion.div>

        {/* Upload Area */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-2">Evidence Documents</label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
              isDragging ? 'border-purple-500 bg-purple-500/10' : 'border-white/20 hover:border-white/40 bg-white/[0.02]'
            }`}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.doc"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isProcessing}
            />
            <Database size={48} className={`mx-auto mb-4 ${isDragging ? 'text-purple-400' : 'text-gray-500'}`} />
            <p className="text-lg text-white mb-2">{isDragging ? 'Drop files here' : 'Drag & drop evidence documents'}</p>
            <p className="text-sm text-gray-500">or click to browse • PDF, Word documents</p>
            <p className="text-xs text-gray-600 mt-2">Annual reports, case studies, KPI reports, testimonials...</p>
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
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-500">{(uploadedFile.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      {uploadedFile.status === 'extracting' && <span className="text-xs text-purple-400">Extracting evidence...</span>}
                      {uploadedFile.status === 'success' && uploadedFile.recordsCreated && <span className="text-xs text-emerald-400">{uploadedFile.recordsCreated} records extracted</span>}
                      {uploadedFile.status === 'error' && <span className="text-xs text-red-400">{uploadedFile.error}</span>}
                    </div>
                    {(uploadedFile.status === 'uploading' || uploadedFile.status === 'extracting') && (
                      <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${uploadedFile.progress}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {uploadedFile.status === 'pending' && !isProcessing && (
                      <button onClick={() => removeFile(index)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <X size={18} className="text-gray-400" />
                      </button>
                    )}
                    {(uploadedFile.status === 'uploading' || uploadedFile.status === 'extracting') && <Loader2 size={20} className="text-purple-400 animate-spin" />}
                    {uploadedFile.status === 'success' && <CheckCircle size={20} className="text-emerald-400" />}
                    {uploadedFile.status === 'error' && <AlertCircle size={20} className="text-red-400" />}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Processing Progress */}
        <AnimatePresence>
          {processingProgress && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -20 }} 
              className="mb-8 p-6 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
                    <Database size={20} className="text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Extracting Evidence</h3>
                    <p className="text-sm text-gray-400">
                      Processing file {processingProgress.currentFile} of {processingProgress.totalFiles}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    {processingProgress.currentFile}<span className="text-gray-500">/{processingProgress.totalFiles}</span>
                  </div>
                  <div className="text-sm text-purple-400 font-mono">
                    ⏱️ {formatTime(elapsedTime)}
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-4">
                <motion.div 
                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(processingProgress.currentFile / processingProgress.totalFiles) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              
              {/* Current file */}
              <div className="p-3 bg-white/5 rounded-lg mb-4">
                <p className="text-xs text-gray-500 mb-1">Currently processing:</p>
                <p className="text-sm text-white truncate">{processingProgress.currentFileName}</p>
                <p className="text-xs text-purple-400 mt-1">{processingProgress.status}</p>
              </div>
              
              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Elapsed</p>
                  <p className="text-lg font-mono font-bold text-white">{formatTime(elapsedTime)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Records Found</p>
                  <p className="text-lg font-bold text-emerald-400">{totalRecords}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Files Done</p>
                  <p className="text-lg font-bold text-white">
                    {files.filter(f => f.status === 'success').length}/{processingProgress.totalFiles}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Total Records */}
        {totalRecords > 0 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-center">
            <p className="text-emerald-400 font-semibold">✓ {totalRecords} evidence records extracted and saved to BidVault</p>
          </motion.div>
        )}

        {/* Submit Button */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
              canSubmit ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:opacity-90' : 'bg-white/10 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2"><Loader2 size={20} className="animate-spin" />Extracting Evidence...</span>
            ) : allComplete ? (
              <span className="flex items-center justify-center gap-2"><CheckCircle size={20} />Complete - Opening BidVault...</span>
            ) : (
              'Extract Evidence to BidVault'
            )}
          </button>
        </motion.div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Upload annual reports, case studies, KPI reports, and other evidence documents.<br />
          BidEngine will automatically extract and categorise evidence for your bids.
        </p>
      </main>
    </div>
  );
}
