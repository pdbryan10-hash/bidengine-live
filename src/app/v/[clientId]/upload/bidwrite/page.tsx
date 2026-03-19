'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Upload, FileText, CheckCircle, AlertCircle,
  Loader2, X, File, FileSpreadsheet, PenTool, HelpCircle, Info
} from 'lucide-react';
import Image from 'next/image';
import { UserButton } from '@clerk/nextjs';

interface UploadedFile {
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  error?: string;
}

export default function BidWriteUploadPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [tenderName, setTenderName] = useState('');
  const [tenderSector, setTenderSector] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Sector options
  const SECTORS = [
    { value: '', label: 'Select sector...' },
    { value: 'Healthcare', label: 'Healthcare / NHS' },
    { value: 'Education', label: 'Education' },
    { value: 'Local Government', label: 'Local Government' },
    { value: 'Justice', label: 'Justice / Prisons' },
    { value: 'Defence', label: 'Defence / MoD' },
    { value: 'Transport', label: 'Transport / Highways' },
    { value: 'Data Centre', label: 'Data Centre' },
    { value: 'Critical Infrastructure', label: 'Critical Infrastructure' },
    { value: 'Retail', label: 'Retail' },
    { value: 'Manufacturing', label: 'Manufacturing' },
    { value: 'Leisure', label: 'Leisure / Hospitality' },
    { value: 'Residential', label: 'Residential' },
    { value: 'Commercial', label: 'Commercial / Office' },
  ];
  
  // Question processing progress
  const [questionProgress, setQuestionProgress] = useState<{
    total: number;
    current: number;
    currentQuestion: string;
    scores: number[];
    startTime: number;
  } | null>(null);
  
  // Elapsed time display
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Update elapsed time every second while processing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (questionProgress?.startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - questionProgress.startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [questionProgress?.startTime]);
  
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
      // Step 0: Fetch client settings (assistant IDs)
      const clientResponse = await fetch(`https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj/Clients/${clientId}`, {
        headers: {
          'Authorization': 'Bearer 33cb561a966f59ad7ea5e29a1906bf36'
        }
      });
      
      const clientData = await clientResponse.json();
      const bidcraft_assistant_id = clientData.response?.bidcraft_assistant_id || null;

      // Step 1: Create tender in Bubble first and get the ID
      const tenderPayload: any = {
        tender_name: tenderName.trim(),
        client: clientId,
        sector: tenderSector || '' // Always include sector
      };
      
      const tenderResponse = await fetch('https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj/Tenders%20Data%20Type', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 33cb561a966f59ad7ea5e29a1906bf36'
        },
        body: JSON.stringify(tenderPayload)
      });

      if (!tenderResponse.ok) {
        throw new Error('Failed to create tender in database');
      }

      const tenderData = await tenderResponse.json();
      const tenderId = tenderData.id; // Bubble returns the new record ID

      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i].file;
        
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'uploading', progress: 20 } : f
        ));

        // Determine file type
        const ext = file.name.toLowerCase();
        let fileType = 'text';
        if (ext.endsWith('.pdf')) fileType = 'pdf';
        else if (ext.endsWith('.docx') || ext.endsWith('.doc')) fileType = 'docx';
        else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) fileType = 'xlsx';

        let payload: any = {
          clientId,
          tenderId,
          tenderName: tenderName.trim(),
          sector: tenderSector, // Include sector for API
          fileName: file.name,
          fileType,
          bidcraft_assistant_id
        };

        // For Word files, extract text in browser using mammoth
        if (fileType === 'docx') {
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, status: 'extracting' as any, progress: 40 } : f
          ));
          
          const arrayBuffer = await file.arrayBuffer();
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ arrayBuffer });
          payload.extractedText = result.value;
          payload.fileBase64 = null; // Don't send binary for Word
        } else {
          // For PDF, send as base64 for n8n to extract
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              const base64Data = result.split(',')[1];
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          payload.fileBase64 = base64;
          payload.extractedText = null;
        }

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, progress: 60 } : f
        ));

        // First, create the tender and questions in Bubble
        const createResponse = await fetch('/api/bidwrite/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        if (!createResponse.ok) {
          throw new Error(`Upload failed: ${createResponse.statusText}`);
        }

        const createResult = await createResponse.json();
        console.log('Upload response:', createResult);

        // Process each question one at a time (to fit in Vercel timeout)
        if (createResult.questions && createResult.questions.length > 0) {
          const totalQuestions = createResult.questions.length;
          const scores: number[] = new Array(totalQuestions).fill(0);
          const startTime = Date.now();
          let completedCount = 0;
          
          // Initialize question progress
          setQuestionProgress({
            total: totalQuestions,
            current: 0,
            currentQuestion: 'Starting...',
            scores: [],
            startTime
          });
          setElapsedTime(0);
          
          // Process in parallel batches
          const BATCH_SIZE = 3;
          const questions = createResult.questions;
          
          for (let batchStart = 0; batchStart < totalQuestions; batchStart += BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + BATCH_SIZE, totalQuestions);
            const batch = questions.slice(batchStart, batchEnd);
            
            // Update progress to show batch being processed
            const batchNumbers = batch.map((q: any) => q.question_number || `Q${questions.indexOf(q) + 1}`).join(', ');
            setQuestionProgress(prev => prev ? {
              ...prev,
              current: completedCount,
              currentQuestion: `Processing: ${batchNumbers}`,
            } : null);
            
            // Process batch in parallel
            const batchPromises = batch.map(async (question: any, batchIdx: number) => {
              const globalIdx = batchStart + batchIdx;
              try {
                const processResponse = await fetch('/api/bidwrite/process-question', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    question_id: question._id,
                    client_id: clientId
                  })
                });
                
                const result = await processResponse.json();
                console.log(`Question ${globalIdx + 1} processed:`, result);
                
                if (result.score) {
                  scores[globalIdx] = result.score;
                }
                return { success: true, score: result.score };
              } catch (err) {
                console.error(`Failed to process question ${globalIdx + 1}:`, err);
                return { success: false, score: 0 };
              }
            });
            
            // Wait for batch to complete
            await Promise.all(batchPromises);
            completedCount = batchEnd;
            
            // Update progress after batch
            setQuestionProgress(prev => prev ? {
              ...prev,
              current: completedCount,
              currentQuestion: completedCount < totalQuestions ? 'Starting next batch...' : 'Complete!',
              scores: scores.filter(s => s > 0),
            } : null);
            
            setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
            
            const progressPerQuestion = 25 / totalQuestions;
            setFiles(prev => prev.map((f, idx) => 
              idx === i ? { ...f, progress: 70 + (completedCount * progressPerQuestion) } : f
            ));
          }
          
          // Final elapsed time
          const finalTime = Math.floor((Date.now() - startTime) / 1000);
          setElapsedTime(finalTime);
          
          // Save processing time to the tender in Bubble
          console.log('Saving processing time:', finalTime, 'to tender:', tenderId);
          try {
            const saveResponse = await fetch(`https://bidenginev1.bubbleapps.io/version-test/api/1.1/obj/Tenders%20Data%20Type/${tenderId}`, {
              method: 'PATCH',
              headers: {
                'Authorization': 'Bearer 33cb561a966f59ad7ea5e29a1906bf36',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ processing_time: finalTime })
            });
            if (saveResponse.ok) {
              console.log('Saved processing time successfully:', finalTime, 'seconds');
            } else {
              const errorText = await saveResponse.text();
              console.error('Failed to save processing time - status:', saveResponse.status, 'error:', errorText);
            }
          } catch (err) {
            console.error('Failed to save processing time:', err);
          }
          
          // Clear question progress when done
          setQuestionProgress(null);
        }

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'success', progress: 100 } : f
        ));
      }

      // Mark processing complete BEFORE redirect
      setIsProcessing(false);
      
      // Wait for UI to update and show success
      await new Promise(r => setTimeout(r, 500));
      
      // Redirect to the specific tender
      console.log('Redirecting to tender:', tenderId);
      router.push(`/v/${clientId}/bidwrite?tender=${tenderId}`);
      
    } catch (error) {
      console.error('Upload error:', error);
      setFiles(prev => prev.map(f => ({ ...f, status: 'error', error: 'Upload failed' })));
      setIsProcessing(false);
    }
  };

  const allComplete = files.length > 0 && files.every(f => f.status === 'success');
  const canSubmit = files.length > 0 && tenderName.trim() && tenderSector && !isProcessing;

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
              <Image src="/bidwrite-logo.svg" alt="BidWrite" width={50} height={50} />
              <div>
                <h1 className="text-xl font-bold text-white">BidWrite</h1>
                <p className="text-[10px] text-blue-400 uppercase tracking-wider">Upload Tender</p>
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
        {/* Tender Name */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">Tender Name</label>
          <input
            type="text"
            value={tenderName}
            onChange={e => setTenderName(e.target.value)}
            placeholder="Enter tender name..."
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500/50 transition-colors text-lg text-white"
          />
        </motion.div>

        {/* Sector Selection */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-2">Client Sector <span className="text-red-400">*</span></label>
          <select
            value={tenderSector}
            onChange={e => setTenderSector(e.target.value)}
            className={`w-full px-4 py-3 bg-white/5 border rounded-xl focus:outline-none focus:border-blue-500/50 transition-colors text-lg text-white appearance-none cursor-pointer ${!tenderSector && files.length > 0 ? 'border-amber-400/60 animate-pulse' : !tenderSector ? 'border-white/10' : 'border-emerald-500/30'}`}
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239ca3af'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5rem' }}
          >
            {SECTORS.map(sector => (
              <option key={sector.value} value={sector.value} className="bg-gray-900 text-white">
                {sector.label}
              </option>
            ))}
          </select>
          {!tenderSector && files.length > 0 && (
            <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">⚠️ Sector is required — it ensures evidence is matched correctly</p>
          )}
          {tenderSector && (
            <p className="text-xs text-emerald-400/60 mt-2">✓ Evidence will be prioritised from {tenderSector} contracts</p>
          )}
        </motion.div>

        {/* Upload Area */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-2">Tender Documents</label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
              isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-white/20 hover:border-white/40 bg-white/[0.02]'
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
            <PenTool size={48} className={`mx-auto mb-4 ${isDragging ? 'text-blue-400' : 'text-gray-500'}`} />
            <p className="text-lg text-white mb-2">{isDragging ? 'Drop files here' : 'Drag & drop tender documents'}</p>
            <p className="text-sm text-gray-500">or click to browse • PDF, Word, Excel</p>
            <p className="text-xs text-gray-600 mt-2">ITT, pricing schedule, supporting documents...</p>
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
                    {(uploadedFile.status === 'uploading' || uploadedFile.status === 'processing') && (
                      <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${uploadedFile.progress}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {uploadedFile.status === 'pending' && !isProcessing && (
                      <button onClick={() => removeFile(index)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <X size={18} className="text-gray-400" />
                      </button>
                    )}
                    {(uploadedFile.status === 'uploading' || uploadedFile.status === 'processing') && <Loader2 size={20} className="text-blue-400 animate-spin" />}
                    {uploadedFile.status === 'success' && <CheckCircle size={20} className="text-emerald-400" />}
                    {uploadedFile.status === 'error' && <AlertCircle size={20} className="text-red-400" />}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Question Processing Progress */}
        <AnimatePresence>
          {questionProgress && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -20 }} 
              className="mb-8 p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <PenTool size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">Generating Responses</h3>
                    <p className="text-sm text-gray-400">
                      Processing question {questionProgress.current} of {questionProgress.total}
                      {questionProgress.currentQuestion && (
                        <span className="text-blue-400 ml-1">({questionProgress.currentQuestion})</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    {questionProgress.current}<span className="text-gray-500">/{questionProgress.total}</span>
                  </div>
                  <div className="text-sm text-cyan-400 font-mono">
                    ⏱️ {formatTime(elapsedTime)}
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-4">
                <motion.div 
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(questionProgress.current / questionProgress.total) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              
              {/* Question Dots */}
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: questionProgress.total }).map((_, idx) => {
                  const isComplete = idx < questionProgress.scores.length;
                  const isCurrent = idx === questionProgress.current - 1;
                  const score = questionProgress.scores[idx];
                  
                  return (
                    <div
                      key={idx}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                        isComplete 
                          ? score >= 8 
                            ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50' 
                            : score >= 6 
                              ? 'bg-amber-500/30 text-amber-400 border border-amber-500/50'
                              : 'bg-red-500/30 text-red-400 border border-red-500/50'
                          : isCurrent 
                            ? 'bg-blue-500/30 text-blue-400 border border-blue-500/50 animate-pulse' 
                            : 'bg-white/5 text-gray-600 border border-white/10'
                      }`}
                      title={isComplete ? `Q${idx + 1}: ${score?.toFixed(1)}/10` : isCurrent ? 'Processing...' : 'Pending'}
                    >
                      {isComplete ? score?.toFixed(0) : isCurrent ? '...' : idx + 1}
                    </div>
                  );
                })}
              </div>
              
              {/* Stats Row */}
              <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Elapsed</p>
                  <p className="text-lg font-mono font-bold text-white">{formatTime(elapsedTime)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Avg Score</p>
                  <p className={`text-lg font-bold ${
                    questionProgress.scores.length > 0
                      ? (questionProgress.scores.reduce((a, b) => a + b, 0) / questionProgress.scores.length) >= 8 
                        ? 'text-emerald-400' 
                        : 'text-amber-400'
                      : 'text-gray-500'
                  }`}>
                    {questionProgress.scores.length > 0 
                      ? (questionProgress.scores.reduce((a, b) => a + b, 0) / questionProgress.scores.length).toFixed(1)
                      : '-'
                    }/10
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Est. Remaining</p>
                  <p className="text-lg font-mono font-bold text-gray-400">
                    {questionProgress.current > 0 
                      ? formatTime(Math.ceil((elapsedTime / questionProgress.current) * (questionProgress.total - questionProgress.current)))
                      : '--:--'
                    }
                  </p>
                </div>
              </div>
              
              {/* Speed indicator */}
              {questionProgress.current > 0 && (
                <p className="text-xs text-gray-500 mt-3 text-center">
                  ⚡ Processing at {(elapsedTime / questionProgress.current).toFixed(1)}s per question
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit Button */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-4 rounded-xl font-semibold text-lg transition-all ${
              canSubmit ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90' : 'bg-white/10 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2"><Loader2 size={20} className="animate-spin" />Processing Tender...</span>
            ) : allComplete ? (
              <span className="flex items-center justify-center gap-2"><CheckCircle size={20} />Complete - Opening BidWrite...</span>
            ) : (
              'Upload & Process Tender'
            )}
          </button>
        </motion.div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Upload the ITT, pricing schedule, and any supporting documents.<br />
          BidEngine will extract questions and match them with your evidence.
        </p>
      </main>
    </div>
  );
}
