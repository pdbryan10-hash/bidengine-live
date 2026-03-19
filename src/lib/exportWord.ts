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
// PROOFWORKS PREMIUM BRAND
// ============================================================================
const BRAND = {
  // Primary
  teal: '0D9488',
  tealLight: '14B8A6',
  tealDark: '0F766E',
  // Dark
  navy: '0F172A',
  slate: '1E293B',
  charcoal: '334155',
  // Neutrals
  gray: '64748B',
  silver: '94A3B8',
  lightGray: 'F1F5F9',
  offWhite: 'F8FAFC',
  white: 'FFFFFF',
  // Accents
  gold: 'F59E0B',
  goldLight: 'FCD34D',
  emerald: '10B981',
  rose: 'F43F5E',
  violet: '8B5CF6',
  // Status
  success: '10B981',
  warning: 'F59E0B', 
  danger: 'EF4444',
  // Borders
  border: 'E2E8F0',
  borderLight: 'F1F5F9',
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

const getScoreColorHex = (score: number): string => {
  if (score >= 8) return BRAND.emerald;
  if (score >= 6) return BRAND.gold;
  return BRAND.rose;
};

const getScoreBgHex = (score: number): string => {
  if (score >= 8) return 'ECFDF5';
  if (score >= 6) return 'FFFBEB';
  return 'FFF1F2';
};

// ============================================================================
// EXPORT TO WORD - PREMIUM DESIGN
// ============================================================================
export async function exportToWord(
  questions: TenderQuestion[], 
  tender?: Tender, 
  tenderName: string = 'Tender Response'
): Promise<void> {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
          AlignmentType, BorderStyle, WidthType, ShadingType, Header, Footer, PageNumber, PageBreak,
          convertInchesToTwip } = await import('docx');

  // Borders
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
  const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: BRAND.border };
  const accentBorder = { style: BorderStyle.SINGLE, size: 12, color: BRAND.teal };

  // Data
  const exportDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const displayTenderName = tender?.tender_name || tenderName;
  const sortedQuestions = sortQuestions(questions);
  const scored = sortedQuestions.filter(q => parseFullEvaluation(q.final_evaluation || '').score > 0);
  const avgScore = scored.length ? scored.reduce((a, q) => a + parseFullEvaluation(q.final_evaluation || '').score, 0) / scored.length : 0;
  
  // Score distribution
  const excellent = scored.filter(q => parseFullEvaluation(q.final_evaluation || '').score >= 8).length;
  const good = scored.filter(q => { const s = parseFullEvaluation(q.final_evaluation || '').score; return s >= 6 && s < 8; }).length;
  const needsWork = scored.filter(q => parseFullEvaluation(q.final_evaluation || '').score < 6).length;

  // ========================================
  // QUESTION PAGES
  // ========================================
  const questionSections: any[] = [];

  sortedQuestions.forEach((q, idx) => {
    const ev = parseFullEvaluation(q.final_evaluation || '');
    const answer = cleanCitationsForExport(stripHtml(q.answer_text));
    const wordCount = answer ? answer.split(/\s+/).filter(w => w.length > 0).length : 0;
    const scoreColor = getScoreColorHex(ev.score);
    const scoreBg = getScoreBgHex(ev.score);

    // ══════════════════════════════════════════════
    // QUESTION HEADER - DRAMATIC GRADIENT STYLE
    // ══════════════════════════════════════════════
    questionSections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [7000, 2360],
        rows: [
          new TableRow({
            children: [
              // Left: Question info
              new TableCell({
                width: { size: 7000, type: WidthType.DXA },
                borders: noBorders,
                shading: { fill: BRAND.navy, type: ShadingType.CLEAR },
                margins: { top: 200, bottom: 200, left: 250, right: 150 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Q${q.question_number || (idx + 1)}`, bold: true, size: 36, color: BRAND.teal }),
                    ]
                  }),
                  new Paragraph({
                    spacing: { before: 60 },
                    children: [
                      new TextRun({ text: q.section || 'General', size: 22, color: BRAND.silver }),
                    ]
                  }),
                ]
              }),
              // Right: Score
              new TableCell({
                width: { size: 2360, type: WidthType.DXA },
                borders: noBorders,
                shading: { fill: scoreColor, type: ShadingType.CLEAR },
                verticalAlign: 'center',
                margins: { top: 150, bottom: 150, left: 100, right: 100 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: ev.score > 0 ? ev.score.toFixed(1) : '—', bold: true, size: 48, color: BRAND.white }),
                    ]
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: ev.score > 0 ? getScoreLabel(ev.score).toUpperCase() : 'PENDING', bold: true, size: 16, color: BRAND.white }),
                    ]
                  }),
                ]
              }),
            ]
          })
        ]
      })
    );

    // Meta bar
    questionSections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [4680, 4680],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 4680, type: WidthType.DXA },
                borders: { top: noBorder, bottom: thinBorder, left: noBorder, right: thinBorder },
                shading: { fill: BRAND.offWhite, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 150, right: 150 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'WORD LIMIT  ', size: 16, color: BRAND.gray }),
                      new TextRun({ text: `${q.word_limit || '—'}`, bold: true, size: 18, color: BRAND.slate }),
                      new TextRun({ text: `  (${wordCount} written)`, size: 16, color: BRAND.silver, italics: true }),
                    ]
                  }),
                ]
              }),
              new TableCell({
                width: { size: 4680, type: WidthType.DXA },
                borders: { top: noBorder, bottom: thinBorder, left: noBorder, right: noBorder },
                shading: { fill: BRAND.offWhite, type: ShadingType.CLEAR },
                margins: { top: 80, bottom: 80, left: 150, right: 150 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({ text: 'WEIGHTING  ', size: 16, color: BRAND.gray }),
                      new TextRun({ text: `${q.weighting || '—'}`, bold: true, size: 18, color: BRAND.slate }),
                    ]
                  }),
                ]
              }),
            ]
          })
        ]
      })
    );

    // ══════════════════════════════════════════════
    // THE QUESTION
    // ══════════════════════════════════════════════
    questionSections.push(new Paragraph({ spacing: { before: 350 } }));
    questionSections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [9360],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 9360, type: WidthType.DXA },
                borders: { top: noBorder, bottom: noBorder, left: accentBorder, right: noBorder },
                shading: { fill: 'F0FDFA', type: ShadingType.CLEAR },
                margins: { top: 180, bottom: 180, left: 250, right: 200 },
                children: [
                  new Paragraph({
                    spacing: { after: 80 },
                    children: [
                      new TextRun({ text: 'THE QUESTION', bold: true, size: 14, color: BRAND.teal, allCaps: true }),
                    ]
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: stripMarkdown(q.question_text) || 'No question text', size: 22, color: BRAND.slate }),
                    ]
                  }),
                ]
              })
            ]
          })
        ]
      })
    );

    // ══════════════════════════════════════════════
    // THE RESPONSE
    // ══════════════════════════════════════════════
    questionSections.push(new Paragraph({ spacing: { before: 300 } }));
    questionSections.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: 'RESPONSE', bold: true, size: 14, color: BRAND.teal, allCaps: true }),
        ]
      })
    );

    // Split answer into paragraphs
    const answerParas = (answer || 'No response generated').split(/\n\n+/).filter(p => p.trim());
    answerParas.forEach(para => {
      questionSections.push(
        new Paragraph({
          spacing: { after: 180 },
          children: [
            new TextRun({ text: stripMarkdown(para.trim()), size: 22, color: BRAND.charcoal }),
          ]
        })
      );
    });

    // ══════════════════════════════════════════════
    // SCORE ANALYSIS (if scored)
    // ══════════════════════════════════════════════
    if (ev.score > 0 && ev.summary) {
      questionSections.push(new Paragraph({ spacing: { before: 250 } }));
      questionSections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [9360],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 9360, type: WidthType.DXA },
                  borders: noBorders,
                  shading: { fill: scoreBg, type: ShadingType.CLEAR },
                  margins: { top: 150, bottom: 150, left: 200, right: 200 },
                  children: [
                    new Paragraph({
                      spacing: { after: 80 },
                      children: [
                        new TextRun({ text: '✦ ANALYSIS', bold: true, size: 14, color: scoreColor }),
                      ]
                    }),
                    new Paragraph({
                      children: [
                        new TextRun({ text: stripMarkdown(ev.summary), size: 20, italics: true, color: BRAND.slate }),
                      ]
                    }),
                  ]
                })
              ]
            })
          ]
        })
      );
    }

    // ══════════════════════════════════════════════
    // COMPLIANCE (Green checks)
    // ══════════════════════════════════════════════
    if (ev.complianceChecks.length > 0) {
      questionSections.push(new Paragraph({ spacing: { before: 250 } }));
      questionSections.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({ text: '✓ COMPLIANCE MET', bold: true, size: 14, color: BRAND.emerald }),
          ]
        })
      );
      ev.complianceChecks.forEach(check => {
        questionSections.push(
          new Paragraph({
            spacing: { before: 40 },
            indent: { left: 300 },
            children: [
              new TextRun({ text: '●  ', size: 18, color: BRAND.emerald }),
              new TextRun({ text: stripMarkdown(check), size: 20, color: BRAND.slate }),
            ]
          })
        );
      });
    }

    // ══════════════════════════════════════════════
    // GAP ANALYSIS - DRAMATIC CALLOUT BOXES
    // ══════════════════════════════════════════════
    const gaps = [
      { title: '⚠ CRITICAL GAPS', items: ev.gapAnalysis.mustFix, color: BRAND.rose, bg: 'FFF1F2', borderColor: BRAND.rose },
      { title: '△ IMPROVEMENTS NEEDED', items: ev.gapAnalysis.shouldFix, color: BRAND.gold, bg: 'FFFBEB', borderColor: BRAND.gold },
      { title: '○ ENHANCEMENTS', items: ev.gapAnalysis.couldFix, color: BRAND.teal, bg: 'F0FDFA', borderColor: BRAND.teal },
    ];

    gaps.forEach(({ title, items, color, bg, borderColor }) => {
      if (items.length > 0) {
        questionSections.push(new Paragraph({ spacing: { before: 200 } }));
        questionSections.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [9360],
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 9360, type: WidthType.DXA },
                    borders: { 
                      top: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
                      bottom: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
                      left: { style: BorderStyle.SINGLE, size: 18, color: borderColor },
                      right: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
                    },
                    shading: { fill: bg, type: ShadingType.CLEAR },
                    margins: { top: 120, bottom: 120, left: 200, right: 150 },
                    children: [
                      new Paragraph({
                        spacing: { after: 80 },
                        children: [
                          new TextRun({ text: title, bold: true, size: 16, color }),
                        ]
                      }),
                      ...items.map(item => 
                        new Paragraph({
                          spacing: { before: 50 },
                          children: [
                            new TextRun({ text: '→  ', size: 18, color }),
                            new TextRun({ text: stripMarkdown(item), size: 19, color: BRAND.slate }),
                          ]
                        })
                      )
                    ]
                  })
                ]
              })
            ]
          })
        );
      }
    });

    // ══════════════════════════════════════════════
    // TOP IMPROVEMENTS
    // ══════════════════════════════════════════════
    if (ev.topImprovements.length > 0) {
      questionSections.push(new Paragraph({ spacing: { before: 280 } }));
      questionSections.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [
            new TextRun({ text: '★ PRIORITY ACTIONS', bold: true, size: 14, color: BRAND.violet }),
          ]
        })
      );
      ev.topImprovements.forEach((item, i) => {
        questionSections.push(
          new Paragraph({
            spacing: { before: 60 },
            indent: { left: 300 },
            children: [
              new TextRun({ text: `${i + 1}. `, bold: true, size: 20, color: BRAND.violet }),
              new TextRun({ text: stripMarkdown(item), size: 20, color: BRAND.slate }),
            ]
          })
        );
      });
    }

    // Page break
    if (idx < sortedQuestions.length - 1) {
      questionSections.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  // ========================================
  // BUILD DOCUMENT
  // ========================================
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } }
      }
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'PROOFWORKS', bold: true, size: 18, color: BRAND.teal }),
                new TextRun({ text: '  ×  BidEngine™', size: 18, color: BRAND.silver }),
              ]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              columnWidths: [3120, 3120, 3120],
              borders: noBorders,
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ width: { size: 3120, type: WidthType.DXA }, borders: noBorders, children: [
                      new Paragraph({ children: [new TextRun({ text: 'CONFIDENTIAL', size: 14, color: BRAND.silver })] })
                    ]}),
                    new TableCell({ width: { size: 3120, type: WidthType.DXA }, borders: noBorders, children: [
                      new Paragraph({ alignment: AlignmentType.CENTER, children: [
                        new TextRun({ text: 'Page ', size: 14, color: BRAND.silver }),
                        new TextRun({ children: [PageNumber.CURRENT], size: 14, color: BRAND.silver }),
                      ]})
                    ]}),
                    new TableCell({ width: { size: 3120, type: WidthType.DXA }, borders: noBorders, children: [
                      new Paragraph({ alignment: AlignmentType.RIGHT, children: [
                        new TextRun({ text: exportDate, size: 14, color: BRAND.silver }),
                      ]})
                    ]}),
                  ]
                })
              ]
            })
          ]
        })
      },
      children: [
        // ══════════════════════════════════════════════════════════════════
        // COVER PAGE - DRAMATIC PREMIUM DESIGN
        // ══════════════════════════════════════════════════════════════════
        
        // Hero header
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [9360],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 9360, type: WidthType.DXA },
                  borders: noBorders,
                  shading: { fill: BRAND.navy, type: ShadingType.CLEAR },
                  margins: { top: 500, bottom: 500, left: 400, right: 400 },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'PROOFWORKS', bold: true, size: 72, color: BRAND.white }),
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 100 },
                      children: [
                        new TextRun({ text: 'Intelligent Bid Management', size: 28, color: BRAND.teal }),
                      ]
                    }),
                  ]
                })
              ]
            })
          ]
        }),

        new Paragraph({ spacing: { before: 600 } }),

        // Document type
        new Paragraph({
          children: [
            new TextRun({ text: 'TENDER REVIEW', bold: true, size: 24, color: BRAND.silver, allCaps: true }),
          ]
        }),

        new Paragraph({ spacing: { before: 150 } }),

        // Tender name - BIG
        new Paragraph({
          children: [
            new TextRun({ text: displayTenderName, bold: true, size: 56, color: BRAND.navy }),
          ]
        }),

        new Paragraph({ spacing: { before: 500 } }),

        // Score hero
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [4680, 4680],
          rows: [
            new TableRow({
              children: [
                // Overall score
                new TableCell({
                  width: { size: 4680, type: WidthType.DXA },
                  borders: noBorders,
                  shading: { fill: BRAND.navy, type: ShadingType.CLEAR },
                  margins: { top: 300, bottom: 300, left: 300, right: 300 },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'OVERALL SCORE', bold: true, size: 16, color: BRAND.silver }),
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 100 },
                      children: [
                        new TextRun({ text: avgScore > 0 ? avgScore.toFixed(1) : '—', bold: true, size: 120, color: BRAND.teal }),
                        new TextRun({ text: ' /10', size: 40, color: BRAND.silver }),
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 80 },
                      children: [
                        new TextRun({ 
                          text: avgScore >= 8 ? 'EXCELLENT' : avgScore >= 6 ? 'STRONG' : avgScore >= 4 ? 'MODERATE' : 'NEEDS WORK',
                          bold: true, size: 20, color: getScoreColorHex(avgScore)
                        }),
                      ]
                    }),
                  ]
                }),
                // Stats
                new TableCell({
                  width: { size: 4680, type: WidthType.DXA },
                  borders: noBorders,
                  shading: { fill: BRAND.offWhite, type: ShadingType.CLEAR },
                  margins: { top: 250, bottom: 250, left: 300, right: 300 },
                  children: [
                    new Paragraph({
                      spacing: { after: 150 },
                      children: [
                        new TextRun({ text: `${sortedQuestions.length}`, bold: true, size: 40, color: BRAND.navy }),
                        new TextRun({ text: '  questions analysed', size: 20, color: BRAND.gray }),
                      ]
                    }),
                    new Paragraph({
                      spacing: { after: 100 },
                      children: [
                        new TextRun({ text: `${excellent}`, bold: true, size: 28, color: BRAND.emerald }),
                        new TextRun({ text: ' excellent  ', size: 18, color: BRAND.gray }),
                        new TextRun({ text: `${good}`, bold: true, size: 28, color: BRAND.gold }),
                        new TextRun({ text: ' good  ', size: 18, color: BRAND.gray }),
                        new TextRun({ text: `${needsWork}`, bold: true, size: 28, color: BRAND.rose }),
                        new TextRun({ text: ' to improve', size: 18, color: BRAND.gray }),
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 120 },
                      children: [
                        new TextRun({ text: exportDate, size: 18, color: BRAND.silver }),
                      ]
                    }),
                  ]
                }),
              ]
            })
          ]
        }),

        new Paragraph({ spacing: { before: 600 } }),

        // Powered by
        new Paragraph({
          children: [
            new TextRun({ text: 'Powered by ', size: 20, color: BRAND.silver }),
            new TextRun({ text: 'BidEngine™', bold: true, size: 20, color: BRAND.teal }),
            new TextRun({ text: ' — AI-Driven Tender Intelligence', size: 20, color: BRAND.silver }),
          ]
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // ══════════════════════════════════════════════════════════════════
        // EVALUATION SUMMARY
        // ══════════════════════════════════════════════════════════════════
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [9360],
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 9360, type: WidthType.DXA },
                  borders: noBorders,
                  shading: { fill: BRAND.offWhite, type: ShadingType.CLEAR },
                  margins: { top: 300, bottom: 300, left: 300, right: 300 },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: 'EVALUATION SUMMARY', bold: true, size: 24, color: BRAND.navy }),
                      ]
                    }),
                    new Paragraph({
                      spacing: { before: 200 },
                      children: [
                        new TextRun({ 
                          text: `${avgScore >= 8.5 ? 'Excellent' : avgScore >= 8 ? 'Strong' : avgScore >= 7 ? 'Good' : 'Needs improvement'} tender submission achieving an average score of ${avgScore.toFixed(1)}/10 across ${sortedQuestions.length} questions. ${excellent} responses scored excellent (8+), ${good} scored good (6-7.9)${needsWork > 0 ? `, and ${needsWork} need${needsWork === 1 ? 's' : ''} further work` : ''}.`,
                          size: 22, 
                          color: BRAND.charcoal 
                        }),
                      ]
                    }),
                    // Key insights from evaluations
                    ...(() => {
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
                        return [new Paragraph({
                          spacing: { before: 200 },
                          children: [
                            new TextRun({ 
                              text: insights.slice(0, 3).join('. ') + (insights.slice(0, 3).join('. ').endsWith('.') ? '' : '.'),
                              size: 22, 
                              color: BRAND.charcoal 
                            }),
                          ]
                        })];
                      }
                      return [];
                    })(),
                  ]
                })
              ]
            })
          ]
        }),

        new Paragraph({ spacing: { before: 400 } }),

        // All questions
        ...questionSections,
      ]
    }]
  });

  const buffer = await Packer.toBuffer(doc);
  const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${displayTenderName.replace(/[^a-z0-9]/gi, '_')}_ProofWorks.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
