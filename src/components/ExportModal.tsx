'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText, FileSpreadsheet, Loader2, ClipboardList } from 'lucide-react';
import { TenderQuestion, Tender } from '@/types';
import { parseFullEvaluation, getScoreLabel } from '@/lib/bubble';
import { exportToWord } from '@/lib/exportWord';
import { exportToPDF } from '@/lib/exportPDF';

interface ExportModalProps {
  questions: TenderQuestion[];
  tender?: Tender;
  tenderName?: string;
  onClose: () => void;
}

export function ExportModal({ questions, tender, tenderName = 'Tender Response', onClose }: ExportModalProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const stripHtml = (html: string) => (html || '').replace(/<[^>]*>/g, '').trim();

  const sortQuestions = (qs: TenderQuestion[]) => {
    return [...qs].sort((a, b) => {
      const aNum = a.question_number || '';
      const bNum = b.question_number || '';
      const aMatch = aNum.match(/^(\d+)(.*)$/);
      const bMatch = bNum.match(/^(\d+)(.*)$/);
      if (aMatch && bMatch) {
        const aNumeric = parseInt(aMatch[1], 10);
        const bNumeric = parseInt(bMatch[1], 10);
        if (aNumeric !== bNumeric) return aNumeric - bNumeric;
        return (aMatch[2] || '').localeCompare(bMatch[2] || '');
      }
      return aNum.localeCompare(bNum);
    });
  };

  // Calculate stats
  const sortedQuestions = sortQuestions(questions);
  const scored = sortedQuestions.filter(q => parseFullEvaluation(q.final_evaluation || '').score > 0);
  const avgScore = scored.length 
    ? scored.reduce((a, q) => a + parseFullEvaluation(q.final_evaluation || '').score, 0) / scored.length 
    : 0;
  const totalGaps = sortedQuestions.reduce((acc, q) => {
    const ev = parseFullEvaluation(q.final_evaluation || '');
    return acc + ev.gapAnalysis.mustFix.length + ev.gapAnalysis.shouldFix.length + ev.gapAnalysis.couldFix.length;
  }, 0);

  const displayTenderName = tender?.tender_name || tenderName;

  // Word Export
  const handleWordExport = async () => {
    setExporting('word');
    try {
      await exportToWord(questions, tender, tenderName);
    } catch (error) {
      console.error('Word export failed:', error);
      alert('Word export failed. Please try again.');
    }
    setExporting(null);
  };

  // PDF Export
  const handlePDFExport = async () => {
    setExporting('pdf');
    try {
      await exportToPDF(questions, tender, tenderName);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('PDF export failed. Please try again.');
    }
    setExporting(null);
  };

  // Excel Export
  const handleExcelExport = async () => {
    setExporting('excel');
    try {
      const XLSX = await import('xlsx');
      
      const data = sortedQuestions.map(q => {
        const ev = parseFullEvaluation(q.final_evaluation || '');
        const answer = stripHtml(q.answer_text);
        const wordCount = answer ? answer.split(/\s+/).filter(w => w.length > 0).length : 0;
        return {
          'Question #': q.question_number,
          'Section': q.section || 'General',
          'Question': q.question_text || '',
          'Response': answer,
          'Word Count': wordCount,
          'Word Limit': q.word_limit || '',
          'Weighting': q.weighting || '',
          'Score': ev.score > 0 ? ev.score : '',
          'Score Label': ev.score > 0 ? getScoreLabel(ev.score) : '',
          'Status': q.status || '',
          'Analysis Summary': ev.summary,
          'Must Fix': ev.gapAnalysis.mustFix.join('; '),
          'Should Fix': ev.gapAnalysis.shouldFix.join('; '),
          'Could Fix': ev.gapAnalysis.couldFix.join('; '),
          'Top Improvements': ev.topImprovements.join('; '),
          'Score Potential': ev.scorePotential,
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [
        { wch: 12 }, { wch: 20 }, { wch: 60 }, { wch: 100 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
        { wch: 60 }, { wch: 50 }, { wch: 50 }, { wch: 50 }, { wch: 60 }, { wch: 30 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tender Review');
      XLSX.writeFile(wb, `${displayTenderName.replace(/[^a-z0-9]/gi, '_')}_ProofWorks_Data.xlsx`);
    } catch (error) {
      console.error('Excel export failed:', error);
      alert('Excel export failed. Please try again.');
    }
    setExporting(null);
  };

  // Simple Q&A Word Export - just questions and answers
  const handleSimpleExport = async () => {
    setExporting('simple');
    try {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } = await import('docx');
      
      const children: any[] = [
        // Title
        new Paragraph({
          children: [new TextRun({ text: displayTenderName, bold: true, size: 32 })],
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 400 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `${sortedQuestions.length} Questions`, color: '666666', size: 22 })],
          spacing: { after: 600 },
        }),
      ];

      // Add each question and answer
      sortedQuestions.forEach((q, index) => {
        const answer = stripHtml(q.answer_text) || '[No response yet]';
        
        // Question number and text
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Q${q.question_number || index + 1}: `, bold: true, size: 24 }),
              new TextRun({ text: q.question_text || 'No question text', bold: true, size: 24 }),
            ],
            spacing: { before: 400, after: 200 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            },
          })
        );
        
        // Word limit if exists
        if (q.word_limit) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: `Word limit: ${q.word_limit}`, italics: true, color: '888888', size: 20 })],
              spacing: { after: 200 },
            })
          );
        }
        
        // Answer
        children.push(
          new Paragraph({
            children: [new TextRun({ text: answer, size: 22 })],
            spacing: { after: 400 },
          })
        );
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children,
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${displayTenderName.replace(/[^a-z0-9]/gi, '_')}_QA_Only.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Simple export failed:', error);
      alert('Simple export failed. Please try again.');
    }
    setExporting(null);
  };

  const exportOptions = [
    { format: 'word', label: 'Word', icon: FileText, color: '#2B579A', fn: handleWordExport, desc: 'Full report .docx' },
    { format: 'pdf', label: 'PDF', icon: FileText, color: '#D93025', fn: handlePDFExport, desc: 'Formatted .pdf' },
    { format: 'excel', label: 'Excel', icon: FileSpreadsheet, color: '#217346', fn: handleExcelExport, desc: 'Data .xlsx' },
    { format: 'simple', label: 'Q&A Only', icon: ClipboardList, color: '#6366f1', fn: handleSimpleExport, desc: 'Clean .docx' },
  ];

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
          onClick={e => e.stopPropagation()}
          className="w-full max-w-lg bg-gradient-to-b from-[#0f172a] to-[#1e293b] rounded-2xl overflow-hidden border border-white/10"
        >
          {/* Header with ProofWorks branding */}
          <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Download size={20} />
                  Export Tender Review
                </h2>
                <p className="text-teal-100 text-sm mt-1">ProofWorks / BidEngine™</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                <X size={20} className="text-white" />
              </button>
            </div>
          </div>

          <div className="p-6">
            {/* Tender Name */}
            <div className="bg-white/5 rounded-xl p-4 mb-5 border border-white/10">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tender</p>
              <p className="text-white font-semibold text-lg leading-tight">{displayTenderName}</p>
            </div>

            {/* Stats summary */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                <div className="text-2xl font-bold text-teal-400">{avgScore > 0 ? avgScore.toFixed(1) : '—'}</div>
                <div className="text-xs text-gray-500">Avg Score</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                <div className="text-2xl font-bold text-white">{sortedQuestions.length}</div>
                <div className="text-xs text-gray-500">Questions</div>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/10">
                <div className="text-2xl font-bold text-amber-400">{totalGaps}</div>
                <div className="text-xs text-gray-500">Improvements</div>
              </div>
            </div>

            {/* Export buttons */}
            <div className="grid grid-cols-4 gap-3">
              {exportOptions.map(({ format, label, icon: Icon, color, fn, desc }) => (
                <button
                  key={format}
                  onClick={fn}
                  disabled={exporting !== null}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    exporting === format 
                      ? 'border-teal-500 bg-teal-500/20' 
                      : 'border-white/10 hover:border-white/30 hover:bg-white/5'
                  } ${exporting !== null && exporting !== format ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center" 
                    style={{ background: `${color}25` }}
                  >
                    {exporting === format ? (
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    ) : (
                      <Icon size={24} style={{ color }} />
                    )}
                  </div>
                  <span className="text-sm text-white font-medium">{label}</span>
                  <span className="text-xs text-gray-500">{desc}</span>
                </button>
              ))}
            </div>

            <p className="text-center text-xs text-gray-600 mt-5">
              Word/PDF/Excel include analysis & gaps • Q&A Only = just questions and answers
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
