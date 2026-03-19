'use client';

import { TenderQuestion, Tender } from '@/types';
import { parseFullEvaluation, getScoreLabel } from '@/lib/bubble';

// ============================================================================
// CLEAN CITATIONS FOR EXPORT
// Converts [Client Name | ID] and [Client | ID & ID2] to [1], [2] etc
// ============================================================================
const cleanCitationsForExport = (text: string): string => {
  if (!text) return '';
  
  const seenIds = new Map<string, number>();
  let refNumber = 1;
  
  // Replace [Client | ID] or [Client | ID & ID2] with [n] or [n][m]
  return text.replace(/\[([^\[\]]+?)\s*\|\s*([^\[\]]+)\]/g, (match, client, idsString) => {
    // Split by & to handle multiple IDs
    const ids = idsString.split(/\s*&\s*/)
      .map((id: string) => id.replace(/^(?:ID:\s*)?/, '').trim())
      .filter((id: string) => /^\d+x\d+$/.test(id));
    
    if (ids.length === 0) return match;
    
    const refNums: number[] = [];
    ids.forEach((trimmedId: string) => {
      if (seenIds.has(trimmedId)) {
        refNums.push(seenIds.get(trimmedId)!);
      } else {
        seenIds.set(trimmedId, refNumber);
        refNums.push(refNumber);
        refNumber++;
      }
    });
    
    return refNums.map(n => `[${n}]`).join('');
  });
};

// ============================================================================
// STRIP MARKDOWN FORMATTING (keep project refs)
// ============================================================================
const cleanText = (text: string): string => {
  if (!text) return '';
  return text
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove markdown bold **text** and __text__
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Remove markdown italic *text* and _text_ (but be careful with asterisks in normal text)
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1')
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, '$1')
    // Remove markdown headers
    .replace(/^#{1,6}\s*/gm, '')
    // Clean up double spaces
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const stripHtml = (html: string) => cleanText(html);
const stripMarkdown = (text: string) => cleanText(text);

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

// ============================================================================
// EXPORT TO PDF - PREMIUM DESIGN
// ============================================================================
export async function exportToPDF(
  questions: TenderQuestion[], 
  tender?: Tender, 
  tenderName: string = 'Tender Response'
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  let y = 0;

  // Colors
  const colors = {
    navy: [15, 23, 42],
    teal: [13, 148, 136],
    slate: [30, 41, 59],
    charcoal: [51, 65, 85],
    gray: [100, 116, 139],
    silver: [148, 163, 184],
    emerald: [16, 185, 129],
    gold: [245, 158, 11],
    rose: [244, 63, 94],
    violet: [139, 92, 246],
    white: [255, 255, 255],
    offWhite: [248, 250, 252],
    lightGray: [241, 245, 249],
  };

  const setColor = (c: number[]) => doc.setTextColor(c[0], c[1], c[2]);
  const setFill = (c: number[]) => doc.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: number[]) => doc.setDrawColor(c[0], c[1], c[2]);

  // Data
  const exportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const displayTenderName = tender?.tender_name || tenderName;
  const sortedQuestions = sortQuestions(questions);
  const scored = sortedQuestions.filter(q => parseFullEvaluation(q.final_evaluation || '').score > 0);
  const avgScore = scored.length ? scored.reduce((a, q) => a + parseFullEvaluation(q.final_evaluation || '').score, 0) / scored.length : 0;
  const excellent = scored.filter(q => parseFullEvaluation(q.final_evaluation || '').score >= 8).length;
  const good = scored.filter(q => { const s = parseFullEvaluation(q.final_evaluation || '').score; return s >= 6 && s < 8; }).length;
  const needsWork = scored.filter(q => parseFullEvaluation(q.final_evaluation || '').score < 6).length;

  const getScoreColor = (score: number) => score >= 8 ? colors.emerald : score >= 6 ? colors.gold : colors.rose;

  // ══════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ══════════════════════════════════════════════════════════════════

  // Navy header block
  setFill(colors.navy);
  doc.rect(0, 0, pageWidth, 70, 'F');

  // ProofWorks logo text
  setColor(colors.white);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('PROOFWORKS', margin, 35);

  setColor(colors.teal);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Intelligent Bid Management', margin, 50);

  // Document type
  y = 95;
  setColor(colors.silver);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TENDER REVIEW', margin, y);

  // Tender name
  y += 15;
  setColor(colors.navy);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(displayTenderName, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 12 + 25;

  // Score card
  setFill(colors.navy);
  doc.roundedRect(margin, y, 85, 55, 4, 4, 'F');

  setColor(colors.silver);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('OVERALL SCORE', margin + 10, y + 15);

  setColor(colors.teal);
  doc.setFontSize(42);
  doc.setFont('helvetica', 'bold');
  doc.text(avgScore > 0 ? avgScore.toFixed(1) : '—', margin + 10, y + 42);

  setColor(colors.silver);
  doc.setFontSize(14);
  doc.text('/10', margin + 50, y + 42);

  const scoreLabel = avgScore >= 8 ? 'EXCELLENT' : avgScore >= 6 ? 'STRONG' : avgScore >= 4 ? 'MODERATE' : 'NEEDS WORK';
  setColor(getScoreColor(avgScore));
  doc.setFontSize(10);
  doc.text(scoreLabel, margin + 10, y + 52);

  // Stats panel
  setFill(colors.offWhite);
  doc.roundedRect(margin + 90, y, 85, 55, 4, 4, 'F');

  setColor(colors.navy);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(String(sortedQuestions.length), margin + 100, y + 18);
  setColor(colors.gray);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('questions analysed', margin + 100, y + 26);

  // Mini stats
  const statsY = y + 38;
  setColor(colors.emerald);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(String(excellent), margin + 100, statsY);
  setColor(colors.gray);
  doc.setFontSize(7);
  doc.text('excellent', margin + 110, statsY);

  setColor(colors.gold);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(String(good), margin + 130, statsY);
  setColor(colors.gray);
  doc.setFontSize(7);
  doc.text('good', margin + 138, statsY);

  setColor(colors.rose);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(String(needsWork), margin + 155, statsY);
  setColor(colors.gray);
  doc.setFontSize(7);
  doc.text('improve', margin + 163, statsY);

  // Date
  y += 65;
  setColor(colors.silver);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(exportDate, margin, y);

  // Powered by
  y = pageHeight - 30;
  setColor(colors.silver);
  doc.setFontSize(9);
  doc.text('Powered by ', margin, y);
  setColor(colors.teal);
  doc.setFont('helvetica', 'bold');
  doc.text('BidEngine™', margin + 22, y);
  setColor(colors.silver);
  doc.setFont('helvetica', 'normal');
  doc.text(' — AI-Driven Tender Intelligence', margin + 45, y);

  // ══════════════════════════════════════════════════════════════════
  // EVALUATION SUMMARY PAGE
  // ══════════════════════════════════════════════════════════════════
  doc.addPage();
  
  // Summary header
  y = margin;
  setFill(colors.offWhite);
  doc.rect(margin, y, pageWidth - 2 * margin, 80, 'F');
  
  y += 15;
  setColor(colors.navy);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('EVALUATION SUMMARY', margin + 10, y);
  
  // Build summary text
  const scoreDesc = avgScore >= 8.5 ? 'Excellent' : avgScore >= 8 ? 'Strong' : avgScore >= 7 ? 'Good' : 'Needs improvement';
  const summaryPara1 = `${scoreDesc} tender submission achieving an average score of ${avgScore.toFixed(1)}/10 across ${sortedQuestions.length} questions. ${excellent} responses scored excellent (8+), ${good} scored good (6-7.9)${needsWork > 0 ? `, and ${needsWork} need${needsWork === 1 ? 's' : ''} further work` : ''}.`;
  
  y += 15;
  setColor(colors.charcoal);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const splitSummary1 = doc.splitTextToSize(summaryPara1, pageWidth - 2 * margin - 20);
  doc.text(splitSummary1, margin + 10, y);
  y += splitSummary1.length * 5;
  
  // Key insights from evaluations
  const summaries = sortedQuestions
    .map(q => parseFullEvaluation(q.evaluation_text || q.final_evaluation || '').summary)
    .filter(s => s && s.length > 0);
  const insights: string[] = [];
  summaries.slice(0, 5).forEach(s => {
    const sentences = s.split(/[.!]/).filter(sent => sent.trim().length > 15);
    sentences.forEach(sent => {
      const trimmed = sent.trim();
      if (trimmed.length > 20 && trimmed.length < 300 && !insights.some(i => i.toLowerCase().includes(trimmed.toLowerCase().slice(0, 30)))) {
        insights.push(trimmed);
      }
    });
  });
  
  if (insights.length > 0) {
    y += 8;
    const insightText = insights.slice(0, 3).join('. ') + (insights.slice(0, 3).join('. ').endsWith('.') ? '' : '.');
    const splitInsights = doc.splitTextToSize(insightText, pageWidth - 2 * margin - 20);
    doc.text(splitInsights, margin + 10, y);
  }

  // ══════════════════════════════════════════════════════════════════
  // QUESTION PAGES
  // ══════════════════════════════════════════════════════════════════
  sortedQuestions.forEach((q, idx) => {
    doc.addPage();
    const ev = parseFullEvaluation(q.final_evaluation || '');
    const answer = cleanCitationsForExport(stripHtml(q.answer_text));
    const wordCount = answer ? answer.split(/\s+/).filter(w => w.length > 0).length : 0;
    const scoreColor = getScoreColor(ev.score);

    // Header bar
    setFill(colors.navy);
    doc.rect(0, 0, pageWidth - 35, 25, 'F');
    setFill(scoreColor);
    doc.rect(pageWidth - 35, 0, 35, 25, 'F');

    // Q number
    setColor(colors.teal);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Q${q.question_number || (idx + 1)}`, margin, 16);

    // Section
    setColor(colors.silver);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(q.section || 'General', margin + 25, 16);

    // Score
    setColor(colors.white);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(ev.score > 0 ? ev.score.toFixed(1) : '—', pageWidth - 25, 14, { align: 'center' });
    doc.setFontSize(7);
    doc.text(ev.score > 0 ? getScoreLabel(ev.score).toUpperCase() : 'PENDING', pageWidth - 25, 21, { align: 'center' });

    // Meta bar
    y = 30;
    setFill(colors.offWhite);
    doc.rect(0, y, pageWidth, 12, 'F');
    setColor(colors.gray);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`WORD LIMIT: ${q.word_limit || '—'}  (${wordCount} written)`, margin, y + 8);
    doc.text(`WEIGHTING: ${q.weighting || '—'}`, pageWidth - margin - 40, y + 8);

    y = 52;

    // Question box
    setFill(colors.teal);
    doc.rect(margin, y, 3, 0); // Will set height after measuring
    setFill([240, 253, 250]);
    const qText = stripMarkdown(q.question_text) || 'No question text';
    const qLines = doc.splitTextToSize(qText, contentWidth - 15);
    const qBoxHeight = qLines.length * 5 + 14;
    doc.roundedRect(margin, y, contentWidth, qBoxHeight, 2, 2, 'F');
    setFill(colors.teal);
    doc.rect(margin, y, 3, qBoxHeight, 'F');

    setColor(colors.teal);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('THE QUESTION', margin + 8, y + 8);

    setColor(colors.slate);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(qLines, margin + 8, y + 16);
    y += qBoxHeight + 10;

    // Response
    setColor(colors.teal);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('RESPONSE', margin, y);
    y += 6;

    setColor(colors.slate);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const answerText = answer || 'No response generated';
    const answerLines = doc.splitTextToSize(stripMarkdown(answerText), contentWidth);
    
    answerLines.forEach((line: string) => {
      if (y > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += 4.5;
    });
    y += 6;

    // Analysis (if scored)
    if (ev.score > 0 && ev.summary && y < pageHeight - 50) {
      const scoreBg = ev.score >= 8 ? [236, 253, 245] : ev.score >= 6 ? [255, 251, 235] : [255, 241, 242];
      setFill(scoreBg);
      const summaryLines = doc.splitTextToSize(stripMarkdown(ev.summary), contentWidth - 15);
      const summaryHeight = summaryLines.length * 4 + 12;
      doc.roundedRect(margin, y, contentWidth, summaryHeight, 2, 2, 'F');

      setColor(scoreColor);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('ANALYSIS', margin + 6, y + 7);

      setColor(colors.slate);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.text(summaryLines, margin + 6, y + 14);
      y += summaryHeight + 6;
    }

    // Compliance
    if (ev.complianceChecks.length > 0) {
      const wrappedChecks = ev.complianceChecks.slice(0, 6).map(check => {
        return doc.splitTextToSize('- ' + stripMarkdown(check), contentWidth - 10);
      });
      const totalCheckLines = wrappedChecks.reduce((sum, lines) => sum + lines.length, 0);
      const checksHeight = totalCheckLines * 4.5 + 8;

      if (y + checksHeight > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }

      setColor(colors.emerald);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('COMPLIANCE MET', margin, y);
      y += 5;
      setColor(colors.slate);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      wrappedChecks.forEach((lines) => {
        lines.forEach((line: string) => {
          doc.text(line, margin + 3, y);
          y += 4.5;
        });
      });
      y += 4;
    }

    // Gap boxes
    const gaps = [
      { title: 'CRITICAL GAPS', items: ev.gapAnalysis.mustFix, color: colors.rose, bg: [255, 241, 242] },
      { title: 'IMPROVEMENTS', items: ev.gapAnalysis.shouldFix, color: colors.gold, bg: [255, 251, 235] },
      { title: 'ENHANCEMENTS', items: ev.gapAnalysis.couldFix, color: colors.teal, bg: [240, 253, 250] },
    ];

    gaps.forEach(({ title, items, color, bg }) => {
      if (items.length > 0) {
        // Calculate actual height needed with text wrapping
        const wrappedItems = items.slice(0, 5).map(item => {
          const text = `→  ${stripMarkdown(item)}`;
          return doc.splitTextToSize(text, contentWidth - 15);
        });
        const totalLines = wrappedItems.reduce((sum, lines) => sum + lines.length, 0);
        const boxHeight = totalLines * 4.5 + 12;

        // Check if we need a new page
        if (y + boxHeight > pageHeight - 25) {
          doc.addPage();
          y = 20;
        }

        setFill(bg);
        doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'F');
        setFill(color);
        doc.rect(margin, y, 2.5, boxHeight, 'F');

        setColor(color);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text(title, margin + 6, y + 6);

        setColor(colors.slate);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        let itemY = y + 12;
        wrappedItems.forEach((lines) => {
          lines.forEach((line: string) => {
            doc.text(line, margin + 6, itemY);
            itemY += 4.5;
          });
        });
        y += boxHeight + 4;
      }
    });

    // Priority actions
    if (ev.topImprovements.length > 0) {
      // Calculate height needed
      const wrappedActions = ev.topImprovements.slice(0, 5).map((item, i) => {
        const text = `${i + 1}. ${stripMarkdown(item)}`;
        return doc.splitTextToSize(text, contentWidth - 10);
      });
      const totalActionLines = wrappedActions.reduce((sum, lines) => sum + lines.length, 0);
      const actionsHeight = totalActionLines * 4.5 + 8;

      if (y + actionsHeight > pageHeight - 25) {
        doc.addPage();
        y = 20;
      }

      setColor(colors.violet);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('★ PRIORITY ACTIONS', margin, y);
      y += 5;
      setColor(colors.slate);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      wrappedActions.forEach((lines) => {
        lines.forEach((line: string) => {
          doc.text(line, margin + 3, y);
          y += 4.5;
        });
      });
    }

    // Footer
    setColor(colors.silver);
    doc.setFontSize(7);
    doc.text('CONFIDENTIAL', margin, pageHeight - 8);
    doc.text(`Page ${doc.internal.pages.length - 1}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text('PROOFWORKS × BidEngine™', pageWidth - margin, pageHeight - 8, { align: 'right' });
  });

  doc.save(`${displayTenderName.replace(/[^a-z0-9]/gi, '_')}_ProofWorks.pdf`);
}
