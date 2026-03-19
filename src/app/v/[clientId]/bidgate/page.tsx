'use client';

import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Shield, AlertTriangle, CheckCircle, XCircle,
  FileText, RefreshCw, Target, Zap, Calendar, Building2,
  PoundSterling, Clock, Printer, ArrowRight, Ban, TrendingUp,
  Database, BarChart3, Scale, Award, Download
} from 'lucide-react';
import Image from 'next/image';
import { UserButton } from '@clerk/nextjs';
import ClientBadge from '@/components/ClientBadge';

export default function BidGatePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const tenderName = searchParams.get('tender') || 'Tender Analysis';

  const [analysis, setAnalysis] = useState<any>(null);
  const [evidenceCounts, setEvidenceCounts] = useState<Record<string, number>>({});
  const [totalEvidence, setTotalEvidence] = useState<number>(0);
  const [bidlearn, setBidlearn] = useState<any>(null);
  const [buyerName, setBuyerName] = useState<string | null>(null);
  const [buyerOrgType, setBuyerOrgType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('decision');
  const [downloading, setDownloading] = useState(false);

  const downloadPDF = useCallback(async () => {
    if (!analysis) return;
    setDownloading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210; const H = 297; const margin = 16; const colW = W - margin * 2;
      let y = 0;

      const newPage = (pageNum: number) => {
        if (pageNum > 1) doc.addPage();
        doc.setFillColor(10, 10, 10); doc.rect(0, 0, W, H, 'F');
        doc.setFontSize(7); doc.setTextColor(80,80,80); doc.setFont('helvetica','normal');
        doc.text('CONFIDENTIAL — BidEngine BidGate Analysis', margin, H - 8);
        doc.text(`Page ${pageNum}`, W - margin, H - 8, {align:'right'});
        y = 20;
      };
      const chk = (n = 20) => { if (y + n > H - 16) { doc.addPage(); doc.setFillColor(10,10,10); doc.rect(0,0,W,H,'F'); y = 20; } };
      const sec = (title: string) => {
        chk(14); doc.setFillColor(20,20,20); doc.rect(margin, y - 2, colW, 11, 'F');
        doc.setFontSize(9); doc.setTextColor(245,158,11); doc.setFont('helvetica','bold');
        doc.text(title.toUpperCase(), margin + 4, y + 6); y += 14;
      };
      const row = (label: string, value: string | null | undefined) => {
        if (!value) return; chk(8);
        doc.setFontSize(7.5); doc.setTextColor(130,130,130); doc.setFont('helvetica','bold'); doc.text(label, margin, y);
        doc.setTextColor(215,215,215); doc.setFont('helvetica','normal');
        const ls = doc.splitTextToSize(value, colW - 50); doc.text(ls, margin + 48, y); y += Math.max(6, ls.length * 4.5);
      };
      const bul = (text: string, color: [number,number,number] = [210,210,210], pre = '-') => {
        if (!text) return; chk(7);
        doc.setFontSize(8); doc.setTextColor(...color); doc.setFont('helvetica','normal');
        const ls = doc.splitTextToSize(`${pre}  ${text}`, colW - 8); doc.text(ls, margin + 4, y); y += ls.length * 4.5 + 1;
      };
      const divL = () => { chk(5); doc.setDrawColor(40,40,40); doc.line(margin, y, W-margin, y); y += 5; };
      const fmtD = (d: string|null|undefined) => { if (!d) return null; try { const dt = new Date(d); if (isNaN(dt.getTime())) return d; return dt.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); } catch { return d; } };

      // ── DATA ──────────────────────────────────────────────────────────────
      const tp2 = analysis.tenderProfile || {};
      const kd2 = analysis.keyDates || {};
      const rec2 = analysis.recommendation || {};
      const exec2 = analysis.executiveSummary || {};
      const evid2 = analysis.evidenceAnalysis || {};
      const evalM = analysis.evaluationModel || {};
      const comp2 = analysis.competitivePosition || {};
      const mand2 = analysis.mandatoryRequirements || {};
      const rawS = analysis.readinessScore?.overall ?? analysis.readinessScore?.score ?? analysis.readinessScore ?? 0;
      const score2: number = typeof rawS === 'number' ? rawS : parseFloat(rawS) || 0;
      const decL = rec2.decision === 'BID' || score2 >= 7 ? 'GO' : rec2.decision === 'NO BID' || score2 < 4 ? 'NO-GO' : 'CONDITIONAL GO';
      const decC: [number,number,number] = decL === 'GO' ? [16,185,129] : decL === 'NO-GO' ? [239,68,68] : [245,158,11];

      // ════════════════════════════════════════════════════════════════════
      // PAGE 1 — COVER + DECISION
      // ════════════════════════════════════════════════════════════════════
      newPage(1);
      doc.setFillColor(20,20,20); doc.rect(0,0,W,30,'F');
      doc.setFontSize(20); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.text('BidGate', margin, 14);
      doc.setFontSize(8); doc.setTextColor(245,158,11); doc.setFont('helvetica','normal'); doc.text('GO / NO-GO ANALYSIS', margin, 22);
      doc.setFontSize(8); doc.setTextColor(150,150,150); doc.text(new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}), W-margin, 14, {align:'right'});
      y = 38;
      doc.setFontSize(15); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold');
      const tl = doc.splitTextToSize(tp2.opportunityName || tenderName, colW); doc.text(tl, margin, y); y += tl.length * 7 + 2;
      if (tp2.buyerOrganisation || buyerName) { doc.setFontSize(9); doc.setTextColor(160,160,160); doc.setFont('helvetica','normal'); doc.text((tp2.buyerOrganisation || buyerName || '') + (tp2.buyerType || buyerOrgType ? ` · ${tp2.buyerType || buyerOrgType}` : ''), margin, y); y += 8; }
      y += 3;
      doc.setFillColor(...decC); doc.roundedRect(margin, y, colW, 16, 3, 3, 'F');
      doc.setFontSize(14); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.text(`RECOMMENDATION: ${decL}`, W/2, y+11, {align:'center'}); y += 22;
      const bxs: [string,string][] = [['Readiness',`${score2.toFixed(1)}/10`],['Compliance',(mand2.overallStatus||'').toLowerCase()==='pass'?'CLEAR':'AT RISK'],['Win Probability',(comp2.winProbability||exec2.winProbability||'—').replace(/ \(.+\)/,'')],['Confidence',`${rec2.confidence||score2}/10`]];
      const bw2 = (colW - 6) / 4;
      bxs.forEach(([l,v],i) => { const bx=margin+i*(bw2+2); doc.setFillColor(25,25,25); doc.roundedRect(bx,y,bw2,16,2,2,'F'); doc.setDrawColor(50,50,50); doc.roundedRect(bx,y,bw2,16,2,2,'S'); doc.setFontSize(6); doc.setTextColor(120,120,120); doc.setFont('helvetica','normal'); doc.text(l.toUpperCase(),bx+bw2/2,y+6,{align:'center'}); doc.setFontSize(9); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.text(v,bx+bw2/2,y+13,{align:'center'}); }); y += 22;
      if (rec2.headline) { doc.setFontSize(8.5); doc.setTextColor(190,190,190); doc.setFont('helvetica','italic'); const hl=doc.splitTextToSize(`"${rec2.headline}"`,colW); doc.text(hl,margin,y); y+=hl.length*5+4; }
      const factors2 = rec2.decisionFactors || [];
      if (factors2.length > 0) {
        y += 2; doc.setFontSize(8.5); doc.setTextColor(245,158,11); doc.setFont('helvetica','bold'); doc.text('DECISION FACTORS', margin, y); y += 6;
        factors2.slice(0,6).forEach((f: any) => {
          chk(14); const fg: [number,number,number] = f.score>=7?[16,185,129]:f.score>=5?[245,158,11]:[239,68,68];
          doc.setFillColor(22,22,22); doc.roundedRect(margin,y,colW,9,1,1,'F');
          doc.setFontSize(8); doc.setTextColor(215,215,215); doc.setFont('helvetica','bold'); doc.text(f.factor||'',margin+3,y+6);
          doc.setFontSize(7); doc.setTextColor(130,130,130); doc.setFont('helvetica','normal'); doc.text(f.weight||'',margin+85,y+6);
          const barX=W-margin-36; const barW=30;
          doc.setFillColor(40,40,40); doc.roundedRect(barX,y+3,barW,4,1,1,'F');
          doc.setFillColor(...fg); doc.roundedRect(barX,y+3,(f.score/10)*barW,4,1,1,'F');
          doc.setFontSize(7); doc.setTextColor(...fg); doc.setFont('helvetica','bold'); doc.text(`${f.score}/10`,W-margin-2,y+6,{align:'right'});
          y+=11;
          if (f.rationale) { doc.setFontSize(7); doc.setTextColor(155,155,155); doc.setFont('helvetica','italic'); const rl=doc.splitTextToSize(f.rationale,colW-6); doc.text(rl,margin+3,y); y+=rl.length*4+2; }
        });
      }

      // ════════════════════════════════════════════════════════════════════
      // PAGE 2 — TENDER PROFILE + KEY DATES
      // ════════════════════════════════════════════════════════════════════
      newPage(2); sec('Tender Profile'); y += 1;
      row('Opportunity', tp2.opportunityName || tenderName);
      row('Buyer', tp2.buyerOrganisation || buyerName || null);
      row('Buyer Type', tp2.buyerType || buyerOrgType || null);
      row('Sector', tp2.sector || null);
      row('Region', tp2.region || null);
      row('Services', Array.isArray(tp2.serviceCategories) ? tp2.serviceCategories.join(', ') : (tp2.serviceCategories || null));
      row('Procurement Route', tp2.procurementRoute || null);
      row('Contract Description', tp2.contractDescription || null);
      const cv2 = tp2.contractValue || {}; const cvStr = cv2.annualValue ? `£${(cv2.annualValue/1000000).toFixed(1)}m p.a.` : cv2.totalValue ? `£${(cv2.totalValue/1000000).toFixed(1)}m total` : (cv2.valueRange || null);
      row('Contract Value', cvStr);
      const ct2 = tp2.contractTerm || {}; const ctStr = [ct2.initialTerm, ct2.extensionOptions?`+ ${ct2.extensionOptions}`:null, ct2.totalPossibleTerm?`(${ct2.totalPossibleTerm} total)`:null].filter(Boolean).join(' ');
      row('Contract Term', ctStr || null);
      y += 4; divL(); sec('Key Dates'); y += 1;
      row('Submission Deadline', fmtD(kd2.submissionDeadline));
      row('Days Remaining', kd2.daysUntilSubmission != null ? `${kd2.daysUntilSubmission} days` : null);
      row('Clarification Deadline', fmtD(kd2.clarificationDeadline));
      row('Site Visits', kd2.siteVisitDates || null);
      row('Award Date', fmtD(kd2.awardDate));
      row('Contract Start', fmtD(kd2.contractStartDate));
      row('Mobilisation', kd2.mobilisationPeriod || null);

      // ════════════════════════════════════════════════════════════════════
      // PAGE 3 — EXECUTIVE SUMMARY + MANDATORY REQUIREMENTS
      // ════════════════════════════════════════════════════════════════════
      newPage(3); sec('Executive Summary'); y += 1;
      if (exec2.oneLiner) { doc.setFontSize(9); doc.setTextColor(195,195,195); doc.setFont('helvetica','italic'); const ol=doc.splitTextToSize(exec2.oneLiner,colW); doc.text(ol,margin,y); y+=ol.length*5+5; }
      const strL = exec2.keyStrengths || []; if (strL.length>0) { doc.setFontSize(8.5); doc.setTextColor(52,211,153); doc.setFont('helvetica','bold'); doc.text('Key Strengths',margin,y); y+=5; strL.forEach((s: string)=>bul(s,[52,211,153],'+')); y+=2; }
      const wkL = exec2.keyWeaknesses || exec2.criticalGaps || []; if (wkL.length>0) { doc.setFontSize(8.5); doc.setTextColor(248,113,113); doc.setFont('helvetica','bold'); doc.text('Key Weaknesses',margin,y); y+=5; wkL.forEach((w: string)=>bul(w,[248,113,113],'-')); y+=2; }
      y += 4; divL(); sec('Mandatory Requirements'); y += 1;
      const reqs2 = mand2.requirements || [];
      if (reqs2.length === 0) { doc.setFontSize(8.5); doc.setTextColor(150,150,150); doc.setFont('helvetica','normal'); doc.text('No specific mandatory requirements identified.',margin,y); y+=8; }
      else { reqs2.forEach((req: any) => {
        chk(14); const sc: [number,number,number] = (req.status||'').toLowerCase()==='met'||(req.status||'').toLowerCase()==='pass'?[52,211,153]:(req.status||'').toLowerCase()==='partial'?[245,158,11]:[239,68,68];
        doc.setFillColor(22,22,22); doc.roundedRect(margin,y,colW,9,1,1,'F');
        doc.setFontSize(7.5); doc.setTextColor(...sc); doc.setFont('helvetica','bold'); doc.text((req.status||'').toUpperCase(),W-margin-2,y+6,{align:'right'});
        doc.setTextColor(210,210,210); doc.setFont('helvetica','normal'); const rl=doc.splitTextToSize(req.requirement||'',colW-28); doc.text(rl,margin+3,y+6); y+=11;
        if (req.threshold) { doc.setFontSize(7); doc.setTextColor(140,140,140); doc.text(`Required: ${req.threshold}`,margin+6,y); y+=4.5; }
        if (req.action) { doc.setFontSize(7); doc.setTextColor(245,158,11); doc.text(`Action: ${req.action}`,margin+6,y); y+=4.5; }
        y+=2;
      }); }

      // ════════════════════════════════════════════════════════════════════
      // PAGE 4 — EVIDENCE ANALYSIS
      // ════════════════════════════════════════════════════════════════════
      newPage(4); sec('Evidence Analysis'); y += 1;
      row('Evidence Coverage', evid2.overallEvidenceCoverage || null);
      const strA = evid2.strongAreas || []; if (strA.length>0) { doc.setFontSize(8.5); doc.setTextColor(52,211,153); doc.setFont('helvetica','bold'); doc.text('Strong Areas',margin,y); y+=5; strA.forEach((s: string)=>bul(s,[52,211,153],'+')); y+=3; }
      const gapA = evid2.gapAreas || []; if (gapA.length>0) {
        doc.setFontSize(8.5); doc.setTextColor(248,113,113); doc.setFont('helvetica','bold'); doc.text('Evidence Gaps',margin,y); y+=5;
        gapA.forEach((g: any) => {
          chk(12); const txt=typeof g==='string'?g:(g.area||''); const sev=typeof g==='object'?g.severity||'':''
          const sevC: [number,number,number]=sev==='Critical'?[239,68,68]:sev==='Major'?[245,158,11]:[160,160,160];
          if (sev) { doc.setFontSize(7); doc.setTextColor(...sevC); doc.setFont('helvetica','bold'); doc.text(`[${sev}]`,margin+4,y); doc.setFontSize(8); doc.setTextColor(210,210,210); doc.setFont('helvetica','normal'); const gl=doc.splitTextToSize(txt,colW-22); doc.text(gl,margin+22,y); y+=gl.length*4.5+2; } else bul(txt,[210,210,210],'-');
          if (typeof g==='object'&&g.impact) { doc.setFontSize(7); doc.setTextColor(140,140,140); const il=doc.splitTextToSize(`Impact: ${g.impact}`,colW-8); doc.text(il,margin+6,y); y+=il.length*4+1; }
        }); y+=3;
      }
      const cs2 = evid2.relevantCaseStudies || []; if (cs2.length>0) {
        doc.setFontSize(8.5); doc.setTextColor(100,200,255); doc.setFont('helvetica','bold'); doc.text('Relevant Case Studies',margin,y); y+=5;
        cs2.slice(0,5).forEach((cs: any) => {
          chk(12); const sc2: [number,number,number]=cs.strengthForTender==='High'?[52,211,153]:cs.strengthForTender==='Medium'?[245,158,11]:[160,160,160];
          doc.setFontSize(8); doc.setTextColor(215,215,215); doc.setFont('helvetica','bold'); doc.text(cs.title||'',margin+3,y);
          doc.setFontSize(7); doc.setTextColor(...sc2); doc.text(cs.strengthForTender||'',W-margin-2,y,{align:'right'}); y+=5;
          if (cs.relevance) { doc.setFontSize(7.5); doc.setTextColor(150,150,150); doc.setFont('helvetica','normal'); const rl2=doc.splitTextToSize(cs.relevance,colW-6); doc.text(rl2,margin+6,y); y+=rl2.length*4+2; }
        });
      }

      // ════════════════════════════════════════════════════════════════════
      // PAGE 5 — EVALUATION MODEL + COMPETITIVE POSITION
      // ════════════════════════════════════════════════════════════════════
      newPage(5); sec('Evaluation Model'); y += 1;
      if (evalM.qualityWeighting != null || evalM.priceWeighting != null) {
        const qw=evalM.qualityWeighting||(100-(evalM.priceWeighting||40)); const pw=evalM.priceWeighting||(100-qw);
        doc.setFontSize(9); doc.setTextColor(200,200,200); doc.setFont('helvetica','bold'); doc.text(`Quality / Price Split: ${qw}% / ${pw}%`,margin,y); y+=6;
        doc.setFillColor(100,200,255); doc.roundedRect(margin,y,(qw/100)*colW,5,1,1,'F');
        doc.setFillColor(245,158,11); doc.roundedRect(margin+(qw/100)*colW,y,(pw/100)*colW,5,1,1,'F'); y+=10;
      }
      const crit2 = evalM.criteria || []; if (crit2.length>0) {
        doc.setFontSize(8); doc.setTextColor(130,130,130); doc.setFont('helvetica','bold'); doc.text('CRITERION',margin,y); doc.text('WEIGHT',margin+105,y); doc.text('STRENGTH',margin+125,y); y+=5;
        doc.setDrawColor(40,40,40); doc.line(margin,y,W-margin,y); y+=3;
        crit2.forEach((c: any) => {
          chk(10); const sc3: [number,number,number]=c.ourStrength==='Strong'?[52,211,153]:c.ourStrength==='Medium'?[245,158,11]:[239,68,68];
          doc.setFontSize(8); doc.setTextColor(210,210,210); doc.setFont('helvetica','normal'); doc.text(c.criterion||'',margin,y); doc.text(c.weighting!=null?`${c.weighting}%`:'—',margin+105,y);
          doc.setTextColor(...sc3); doc.setFont('helvetica','bold'); doc.text(c.ourStrength||'—',margin+125,y); y+=6;
          if (c.evidenceGap) { doc.setFontSize(7); doc.setTextColor(200,130,50); doc.setFont('helvetica','italic'); const eg=doc.splitTextToSize(`Gap: ${c.evidenceGap}`,colW-6); doc.text(eg,margin+4,y); y+=eg.length*4+1; }
        });
      }
      y+=4; divL(); sec('Competitive Position'); y+=1;
      const diffs2 = comp2.ourDifferentiators || []; if (diffs2.length>0) { doc.setFontSize(8.5); doc.setTextColor(52,211,153); doc.setFont('helvetica','bold'); doc.text('Our Differentiators',margin,y); y+=5; diffs2.forEach((d: string)=>bul(d,[52,211,153],'+')); y+=3; }
      const thr2 = comp2.competitiveThreats || []; if (thr2.length>0) { doc.setFontSize(8.5); doc.setTextColor(248,113,113); doc.setFont('helvetica','bold'); doc.text('Competitive Threats',margin,y); y+=5; thr2.forEach((t: string)=>bul(t,[248,113,113],'-')); }

      // ════════════════════════════════════════════════════════════════════
      // PAGE 6 — RISKS + NEXT STEPS
      // ════════════════════════════════════════════════════════════════════
      newPage(6); sec('Risk Assessment'); y+=1;
      if (analysis.riskAssessment?.overallRisk) { const orC: [number,number,number]=analysis.riskAssessment.overallRisk==='Low'?[52,211,153]:analysis.riskAssessment.overallRisk==='Medium'?[245,158,11]:[239,68,68]; doc.setFontSize(9); doc.setTextColor(150,150,150); doc.setFont('helvetica','normal'); doc.text('Overall Risk:',margin,y); doc.setTextColor(...orC); doc.setFont('helvetica','bold'); doc.text(analysis.riskAssessment.overallRisk,margin+28,y); y+=7; }
      (analysis.riskAssessment?.risks||[]).slice(0,8).forEach((r: any) => {
        chk(14); const sev2=r.severity||r.impact||'Medium'; const sevC2: [number,number,number]=sev2==='High'?[239,68,68]:sev2==='Medium'?[245,158,11]:[52,211,153];
        doc.setFillColor(22,22,22); doc.roundedRect(margin,y,colW,9,1,1,'F');
        doc.setFontSize(7); doc.setTextColor(...sevC2); doc.setFont('helvetica','bold'); doc.text(sev2.toUpperCase(),margin+3,y+6);
        doc.setFontSize(8); doc.setTextColor(210,210,210); doc.setFont('helvetica','normal'); const riskL=doc.splitTextToSize(r.risk||r.description||'',colW-22); doc.text(riskL,margin+22,y+6); y+=11;
        if (r.mitigation) { doc.setFontSize(7); doc.setTextColor(140,140,140); const ml=doc.splitTextToSize(`Mitigation: ${r.mitigation}`,colW-6); doc.text(ml,margin+4,y); y+=ml.length*4+2; }
      });
      y+=4; divL(); sec('Recommended Next Steps'); y+=1;
      (analysis.nextSteps||[]).slice(0,8).forEach((step: any, i: number) => {
        chk(12); const t=typeof step==='string'?step:(step.action||step.step||''); const pri=typeof step==='object'?step.priority||'':'';
        const priC: [number,number,number]=pri==='Immediate'?[239,68,68]:pri==='This Week'?[245,158,11]:[100,200,255];
        doc.setFontSize(8); doc.setTextColor(100,200,255); doc.setFont('helvetica','bold'); doc.text(`${i+1}.`,margin,y);
        if (pri) { doc.setFontSize(7); doc.setTextColor(...priC); doc.text(pri,W-margin-2,y,{align:'right'}); }
        doc.setFontSize(8.5); doc.setTextColor(210,210,210); doc.setFont('helvetica','normal'); const tl2=doc.splitTextToSize(t,colW-18); doc.text(tl2,margin+8,y); y+=tl2.length*5+3;
      });
      doc.setFontSize(8); doc.setTextColor(100,100,100); doc.text('Generated by BidEngine™',W/2,H-8,{align:'center'});

      doc.save(`BidGate-${(tenderName || 'analysis').replace(/[^a-z0-9]/gi,'_')}.pdf`);
    } finally {
      setDownloading(false);
    }
  }, [analysis, tenderName, buyerName, buyerOrgType]);

  useEffect(() => {
    const storedResult = sessionStorage.getItem('bidgate_result');
    if (storedResult) {
      try {
        const parsed = JSON.parse(storedResult);
        setAnalysis(parsed.analysis);
        setEvidenceCounts(parsed.evidence_counts || {});
        setTotalEvidence(parsed.total_evidence || 0);
        setBidlearn(parsed.bidlearn || null);
        setBuyerName(parsed.buyer_name || null);
        setBuyerOrgType(parsed.buyer_org_type || null);
      } catch (e) {
        console.error('Failed to parse:', e);
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
          <RefreshCw className="text-cyan-500" size={40} />
        </motion.div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <Shield className="text-cyan-500 mx-auto mb-4" size={48} />
          <p className="text-gray-400 mb-6 text-lg">No analysis data found</p>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push(`/v/${clientId}/upload/bidgate`)} 
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl font-semibold"
          >
            Upload Tender
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Parse analysis data
  const rawScore = analysis.readinessScore?.overall ?? analysis.readinessScore?.score ?? analysis.readinessScore ?? 0;
  const readinessScore = typeof rawScore === 'number' ? rawScore : parseFloat(rawScore) || 0;
  const complianceStatus = analysis.mandatoryRequirements?.overallStatus?.toLowerCase() || 
                          analysis.mandatoryCompliance?.overallStatus?.toLowerCase() || 'risk';
  
  const aiDecision = analysis.recommendation?.decision;
  let decision: 'GO' | 'CONDITIONAL' | 'NO-GO' = 'CONDITIONAL';
  let decisionGradient = 'from-amber-500 to-orange-500';
  let decisionBg = 'from-amber-500/10 to-orange-500/5';
  let decisionBorder = 'border-amber-500/30';
  
  if (aiDecision === 'BID' || (readinessScore >= 7 && (complianceStatus === 'pass' || complianceStatus === 'met'))) {
    decision = 'GO';
    decisionGradient = 'from-emerald-500 to-cyan-500';
    decisionBg = 'from-emerald-500/10 to-cyan-500/5';
    decisionBorder = 'border-emerald-500/30';
  } else if (aiDecision === 'NO BID' || readinessScore < 4 || complianceStatus === 'fail') {
    decision = 'NO-GO';
    decisionGradient = 'from-red-500 to-rose-500';
    decisionBg = 'from-red-500/10 to-rose-500/5';
    decisionBorder = 'border-red-500/30';
  }

  const decisionFactors = analysis.recommendation?.decisionFactors || [];
  const decisionConfidence = analysis.recommendation?.confidence || readinessScore;
  const decisionHeadline = analysis.recommendation?.headline || analysis.executiveSummary?.oneLiner || '';
  const evidenceGaps = analysis.evidenceAnalysis?.gapAreas || analysis.evidenceGaps?.gaps || analysis.executiveSummary?.criticalGaps || [];
  const gapCount = Array.isArray(evidenceGaps) ? evidenceGaps.length : 0;
  const winProbability = analysis.competitivePosition?.winProbability || analysis.executiveSummary?.winProbability || 
    (readinessScore >= 7 ? 'High (60%+)' : readinessScore >= 5 ? 'Medium (35-60%)' : 'Low (<35%)');
  const strengths = analysis.executiveSummary?.keyStrengths || [];
  const weaknesses = analysis.executiveSummary?.keyWeaknesses || analysis.executiveSummary?.criticalGaps || [];
  const nextSteps = analysis.nextSteps || [];
  const tenderProfile = analysis.tenderProfile || analysis.tenderSummary || {};
  const keyDates = analysis.keyDates || {};
  const evaluationModel = analysis.evaluationModel || analysis.evaluationCriteria || {};
  const contractValue = tenderProfile.contractValue?.annualValue || tenderProfile.contractValue?.totalValue || 
                       tenderProfile.contractValue?.estimated || analysis.tenderSummary?.contractValue?.annual;

  const formatCurrency = (value: number | string | null | undefined) => {
    if (!value) return null;
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[£,]/g, '')) : value;
    if (isNaN(numValue)) return typeof value === 'string' ? value : null;
    if (numValue >= 1000000) return '£' + (numValue / 1000000).toFixed(1) + 'm';
    if (numValue >= 1000) return '£' + (numValue / 1000).toFixed(0) + 'k';
    return '£' + numValue.toLocaleString();
  };

  const formatDate = (dateStr: string | undefined | null): string | null => {
    if (!dateStr) return null;
    try { 
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); 
    }
    catch { return null; }
  };

  const isValidValue = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string' && (val.toLowerCase() === 'not stated' || val.toLowerCase() === 'not specified' || val.toLowerCase() === 'not provided' || val.trim() === '')) return false;
    return true;
  };

  const tabs = [
    { id: 'decision', label: 'Decision', icon: Target },
    { id: 'bidlearn', label: 'Buyer Intel', icon: TrendingUp },
    { id: 'tender', label: 'Tender Profile', icon: FileText },
    { id: 'evidence', label: 'Evidence', icon: Database },
    { id: 'evaluation', label: 'Evaluation', icon: BarChart3 },
    { id: 'compliance', label: 'Compliance', icon: Shield },
    { id: 'risks', label: 'Risks', icon: AlertTriangle },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] print:bg-white">
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.button whileHover={{ scale: 1.1 }} onClick={() => router.push(`/v/${clientId}`)} className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/10">
              <ArrowLeft size={20} />
            </motion.button>
            <div className="flex items-center gap-3">
              <Image src="/bidgate-logo.svg" alt="BidGate" width={40} height={40} />
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-bold text-white">BidGate</h1>
                  <span className="px-3 py-1 text-xs font-bold bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white rounded-md" style={{boxShadow: '0 0 12px rgba(245,158,11,0.4)'}}>BETA</span>
                </div>
                <p className="text-xs text-gray-500 font-medium tracking-wider">GO/NO-GO ANALYSIS</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ClientBadge clientId={clientId} compact />
            <div className="h-5 w-px bg-white/10" />
            <button onClick={() => router.push(`/v/${clientId}/bidgate/history`)} className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300">Past Analyses</button>
            <button onClick={downloadPDF} disabled={downloading} className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-sm text-amber-400 disabled:opacity-50">
              <Download size={16} /> {downloading ? 'Generating...' : 'Download PDF'}
            </button>
            <button onClick={() => router.push(`/v/${clientId}`)} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-gray-300">← Dashboard</button>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{tenderProfile.opportunityName || tenderProfile.contractTitle || tenderName}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-400 flex-wrap">
                {(tenderProfile.buyerOrganisation || tenderProfile.contractingAuthority) && (
                  <span className="flex items-center gap-1"><Building2 size={14} />{tenderProfile.buyerOrganisation || tenderProfile.contractingAuthority}</span>
                )}
                {formatCurrency(contractValue) && (<span className="flex items-center gap-1"><PoundSterling size={14} />{formatCurrency(contractValue)} p.a.</span>)}
                {formatDate(keyDates.submissionDeadline || tenderProfile.submissionDeadline) && (
                  <span className="flex items-center gap-1"><Calendar size={14} />Due: {formatDate(keyDates.submissionDeadline || tenderProfile.submissionDeadline)}</span>
                )}
                {keyDates.daysUntilSubmission && typeof keyDates.daysUntilSubmission === 'number' && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${keyDates.daysUntilSubmission <= 7 ? 'bg-red-500/20 text-red-400' : keyDates.daysUntilSubmission <= 14 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {keyDates.daysUntilSubmission} days left
                  </span>
                )}
              </div>
            </div>
            <div className={`px-6 py-3 rounded-xl bg-gradient-to-r ${decisionBg} border ${decisionBorder}`}>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Recommendation</p>
              <p className={`text-2xl font-black bg-gradient-to-r ${decisionGradient} bg-clip-text text-transparent`}>
                {decision === 'CONDITIONAL' ? 'CONDITIONAL GO' : decision}
              </p>
              {decisionConfidence && <p className="text-xs text-gray-500 mt-1">Confidence: {decisionConfidence}/10</p>}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-white/10 text-white border border-white/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === 'decision' && (
            <motion.div key="decision" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Readiness</p>
                  <p className={`text-3xl font-bold ${readinessScore >= 7 ? 'text-emerald-400' : readinessScore >= 5 ? 'text-amber-400' : 'text-red-400'}`}>{readinessScore.toFixed(1)}<span className="text-lg text-gray-500">/10</span></p>
                </div>
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Win Probability</p>
                  <p className={`text-xl font-bold ${decision === 'GO' ? 'text-emerald-400' : decision === 'NO-GO' ? 'text-red-400' : 'text-amber-400'}`}>{typeof winProbability === 'string' ? winProbability.split(' ')[0] : winProbability}</p>
                </div>
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Compliance</p>
                  <p className={`text-xl font-bold ${complianceStatus === 'pass' || complianceStatus === 'met' ? 'text-emerald-400' : complianceStatus === 'at risk' || complianceStatus === 'risk' ? 'text-amber-400' : 'text-red-400'}`}>
                    {complianceStatus === 'pass' || complianceStatus === 'met' ? 'Clear' : complianceStatus === 'at risk' || complianceStatus === 'risk' ? 'At Risk' : 'Gaps'}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Evidence Gaps</p>
                  <p className={`text-3xl font-bold ${gapCount === 0 ? 'text-emerald-400' : gapCount <= 2 ? 'text-amber-400' : 'text-red-400'}`}>{gapCount}</p>
                </div>
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Evidence Items</p>
                  <p className="text-3xl font-bold text-purple-400">{totalEvidence}</p>
                </div>
              </div>

              {decisionHeadline && (
                <div className={`bg-gradient-to-br ${decisionBg} border ${decisionBorder} rounded-xl p-6`}>
                  <p className="text-lg text-white leading-relaxed">{decisionHeadline}</p>
                </div>
              )}

              {decisionFactors.length > 0 && (
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-6">
                  <h4 className="text-white font-semibold mb-4 flex items-center gap-2"><Scale size={20} className="text-cyan-400" />Decision Factors</h4>
                  <div className="space-y-3">
                    {decisionFactors.map((factor: any, i: number) => (
                      <div key={i} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-white font-medium">{factor.factor}</span>
                            <span className={`px-2 py-0.5 rounded text-xs ${factor.weight === 'Critical' ? 'bg-red-500/20 text-red-400' : factor.weight === 'High' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'}`}>{factor.weight}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-white/10 rounded-full h-2">
                              <div className={`h-2 rounded-full ${factor.score >= 7 ? 'bg-emerald-500' : factor.score >= 5 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${factor.score * 10}%` }} />
                            </div>
                            <span className={`text-lg font-bold ${factor.score >= 7 ? 'text-emerald-400' : factor.score >= 5 ? 'text-amber-400' : 'text-red-400'}`}>{factor.score}/10</span>
                          </div>
                        </div>
                        {factor.rationale && <p className="text-gray-400 text-sm">{factor.rationale}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
                  <h4 className="text-emerald-400 font-semibold mb-4 flex items-center gap-2"><CheckCircle size={20} />Key Strengths</h4>
                  <ul className="space-y-3">
                    {strengths.slice(0, 4).map((s: string, i: number) => (<li key={i} className="flex items-start gap-3 text-gray-300"><span className="text-emerald-400 mt-1">•</span><span>{s}</span></li>))}
                    {strengths.length === 0 && <li className="text-gray-500 italic">No specific strengths identified</li>}
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 rounded-xl p-6">
                  <h4 className="text-red-400 font-semibold mb-4 flex items-center gap-2"><AlertTriangle size={20} />Key Weaknesses</h4>
                  <ul className="space-y-3">
                    {weaknesses.slice(0, 4).map((w: any, i: number) => (<li key={i} className="flex items-start gap-3 text-gray-300"><span className="text-red-400 mt-1">•</span><span>{typeof w === 'string' ? w : w.area || w.gap}</span></li>))}
                    {weaknesses.length === 0 && <li className="text-gray-500 italic">No critical weaknesses identified</li>}
                  </ul>
                </div>
              </div>

              {nextSteps.length > 0 && (
                <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/5 border border-cyan-500/20 rounded-xl p-6">
                  <h4 className="text-cyan-400 font-semibold mb-4 flex items-center gap-2"><Zap size={20} />Recommended Next Steps</h4>
                  <ol className="space-y-3">
                    {nextSteps.slice(0, 5).map((step: any, i: number) => {
                      const stepText = typeof step === 'string' ? step : (step.action || step.step || step.recommendation || '');
                      const stepPriority = typeof step?.priority === 'string' ? step.priority : null;
                      return (
                        <li key={i} className="flex items-start gap-3 text-gray-300">
                          <span className="bg-cyan-500/20 text-cyan-400 font-bold rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">{i + 1}</span>
                          <div>
                            <span>{stepText}</span>
                            {stepPriority && <span className={`ml-2 px-2 py-0.5 rounded text-xs ${stepPriority === 'Immediate' ? 'bg-red-500/20 text-red-400' : stepPriority === 'This Week' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'}`}>{stepPriority}</span>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              <div className="flex flex-wrap gap-4 pt-4">
                {decision === 'GO' && (
                  <button onClick={() => router.push(`/v/${clientId}/bidwrite`)} className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity">
                    <CheckCircle size={20} />Proceed to BidWrite<ArrowRight size={20} />
                  </button>
                )}
                {decision === 'CONDITIONAL' && (
                  <>
                    <button onClick={() => router.push(`/v/${clientId}/bidwrite`)} className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity">
                      <Zap size={20} />Proceed & Fix Gaps<ArrowRight size={20} />
                    </button>
                    <button onClick={() => router.push(`/v/${clientId}/bidwrite`)} className="flex items-center justify-center gap-2 px-6 py-4 bg-white/5 border border-white/20 text-gray-300 font-semibold rounded-xl hover:bg-white/10 transition-colors">
                      <AlertTriangle size={20} />Proceed As-Is
                    </button>
                  </>
                )}
                {decision === 'NO-GO' && (
                  <>
                    <button onClick={() => router.push(`/v/${clientId}`)} className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity">
                      <Ban size={20} />Decline Opportunity
                    </button>
                    <button onClick={() => router.push(`/v/${clientId}/bidwrite`)} className="flex items-center justify-center gap-2 px-6 py-4 bg-red-500/10 border border-red-500/30 text-red-400 font-semibold rounded-xl hover:bg-red-500/20 transition-colors">
                      <AlertTriangle size={20} />Proceed Anyway
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'bidlearn' && (
            <motion.div key="bidlearn" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-5">
              {/* Header */}
              <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/10 border border-cyan-500/20 rounded-xl p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h4 className="text-white font-semibold flex items-center gap-2 mb-1">
                      <TrendingUp size={18} className="text-cyan-400" /> BidLearn Buyer Intelligence
                    </h4>
                    <p className="text-gray-400 text-sm">
                      {buyerName ? `History with ${buyerName}` : 'No buyer specified'}
                      {buyerOrgType ? ` · ${buyerOrgType}` : ''}
                    </p>
                  </div>
                  {bidlearn?.hasPriorBids && (
                    <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-lg text-xs font-semibold border border-cyan-500/30">
                      Prior bid history found
                    </span>
                  )}
                </div>
              </div>

              {!bidlearn || (!bidlearn.hasPriorBids && !bidlearn.sectorProfile) ? (
                <div className="bg-white/[0.03] border border-white/10 border-dashed rounded-xl p-8 text-center">
                  <BarChart3 className="mx-auto text-gray-600 mb-3" size={36} />
                  <p className="text-gray-400 font-medium mb-1">No prior intelligence found</p>
                  <p className="text-gray-600 text-sm">
                    {buyerName
                      ? `No bid history recorded with ${buyerName} yet. Record outcomes in BidLearn to build intelligence.`
                      : 'Enter a contracting authority name when running BidGate to apply buyer intelligence.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* Buyer-specific profile */}
                  {bidlearn.profile && (
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-4">
                      <h5 className="text-sm font-semibold text-white">Buyer Profile — {buyerName}</h5>
                      <div className="flex gap-6 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Win Rate</p>
                          <p className={`font-bold text-lg ${(bidlearn.profile.win_rate ?? 0) >= 0.6 ? 'text-emerald-400' : (bidlearn.profile.win_rate ?? 0) >= 0.4 ? 'text-amber-400' : 'text-red-400'}`}>
                            {Math.round((bidlearn.profile.win_rate ?? 0) * 100)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Bids</p>
                          <p className="font-bold text-lg text-white">{bidlearn.profile.total_bids ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs uppercase tracking-wide mb-0.5">Last Outcome</p>
                          <p className={`font-bold text-sm ${bidlearn.profile.last_outcome === 'win' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {bidlearn.profile.last_outcome?.toUpperCase() ?? '—'}
                          </p>
                        </div>
                      </div>
                      {bidlearn.profile.profile_summary && (
                        <p className="text-gray-300 text-sm leading-relaxed">{bidlearn.profile.profile_summary}</p>
                      )}
                      {bidlearn.profile.strong_categories && (
                        <div>
                          <p className="text-xs text-emerald-400 uppercase tracking-wide mb-1.5">Strong with this buyer</p>
                          <div className="flex flex-wrap gap-1.5">
                            {bidlearn.profile.strong_categories.split(',').map((c: string) => (
                              <span key={c} className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded text-xs font-medium">{c.trim()}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {bidlearn.profile.weak_categories && (
                        <div>
                          <p className="text-xs text-red-400 uppercase tracking-wide mb-1.5">Weak with this buyer</p>
                          <div className="flex flex-wrap gap-1.5">
                            {bidlearn.profile.weak_categories.split(',').map((c: string) => (
                              <span key={c} className="px-2 py-0.5 bg-red-500/15 text-red-400 rounded text-xs font-medium">{c.trim()}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Loss warnings */}
                  {bidlearn.lossWarnings?.length > 0 && (
                    <div className="bg-red-900/10 border border-red-500/20 rounded-xl p-5">
                      <h5 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-3">
                        <AlertTriangle size={15} /> Known Risk Patterns
                      </h5>
                      <ul className="space-y-2">
                        {bidlearn.lossWarnings.map((w: string, i: number) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-red-400 mt-0.5 flex-shrink-0">•</span> {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Sector profile */}
                  {bidlearn.sectorProfile && (
                    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-3">
                      <h5 className="text-sm font-semibold text-white">Sector Intelligence — {bidlearn.sectorProfile.org_type}</h5>
                      {bidlearn.sectorProfile.profile_summary && (
                        <p className="text-gray-300 text-sm leading-relaxed">{bidlearn.sectorProfile.profile_summary}</p>
                      )}
                      {bidlearn.sectorProfile.common_strengths && (
                        <div>
                          <p className="text-xs text-emerald-400 uppercase tracking-wide mb-1">What scores well sector-wide</p>
                          <p className="text-gray-300 text-sm">{bidlearn.sectorProfile.common_strengths}</p>
                        </div>
                      )}
                      {bidlearn.sectorProfile.common_weaknesses && (
                        <div>
                          <p className="text-xs text-red-400 uppercase tracking-wide mb-1">Common pitfalls</p>
                          <p className="text-gray-300 text-sm">{bidlearn.sectorProfile.common_weaknesses}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'tender' && (
            <motion.div key="tender" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-6">
                <h4 className="text-white font-semibold mb-6 flex items-center gap-2"><FileText size={20} className="text-cyan-400" />Tender Overview</h4>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Opportunity Name</p><p className="text-white font-medium">{tenderProfile.opportunityName || tenderProfile.contractTitle || tenderName}</p></div>
                    <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Buyer Organisation</p><p className="text-white">{tenderProfile.buyerOrganisation || tenderProfile.contractingAuthority || 'Not specified'}</p></div>
                    <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Buyer Type</p><p className="text-white">{tenderProfile.buyerType || 'Not specified'}</p></div>
                    <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Sector</p><p className="text-white">{tenderProfile.sector || 'Not specified'}</p></div>
                    <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Region</p><p className="text-white">{tenderProfile.region || 'Not specified'}</p></div>
                  </div>
                  <div className="space-y-4">
                    <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Service Categories</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(tenderProfile.serviceCategories || []).map((cat: string, i: number) => (<span key={i} className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-sm">{cat}</span>))}
                        {(!tenderProfile.serviceCategories || tenderProfile.serviceCategories.length === 0) && <span className="text-gray-500">Not specified</span>}
                      </div>
                    </div>
                    <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Procurement Route</p><p className="text-white">{tenderProfile.procurementRoute || 'Not specified'}</p></div>
                    {tenderProfile.contractDescription && <div><p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</p><p className="text-gray-300 text-sm">{tenderProfile.contractDescription}</p></div>}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
                  <h4 className="text-emerald-400 font-semibold mb-4 flex items-center gap-2"><PoundSterling size={20} />Contract Value</h4>
                  <div className="space-y-3">
                    {formatCurrency(tenderProfile.contractValue?.annualValue) && <div className="flex justify-between"><span className="text-gray-400">Annual Value</span><span className="text-white font-semibold">{formatCurrency(tenderProfile.contractValue.annualValue)}</span></div>}
                    {formatCurrency(tenderProfile.contractValue?.totalValue) && <div className="flex justify-between"><span className="text-gray-400">Total Value</span><span className="text-white font-semibold">{formatCurrency(tenderProfile.contractValue.totalValue)}</span></div>}
                    {isValidValue(tenderProfile.contractValue?.valueRange) && <div className="flex justify-between"><span className="text-gray-400">Value Range</span><span className="text-white font-semibold">{tenderProfile.contractValue.valueRange}</span></div>}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20 rounded-xl p-6">
                  <h4 className="text-purple-400 font-semibold mb-4 flex items-center gap-2"><Clock size={20} />Contract Term</h4>
                  <div className="space-y-3">
                    {isValidValue(tenderProfile.contractTerm?.initialTerm) && <div className="flex justify-between"><span className="text-gray-400">Initial Term</span><span className="text-white font-semibold">{tenderProfile.contractTerm.initialTerm}</span></div>}
                    {isValidValue(tenderProfile.contractTerm?.extensionOptions) && <div className="flex justify-between"><span className="text-gray-400">Extensions</span><span className="text-white font-semibold">{tenderProfile.contractTerm.extensionOptions}</span></div>}
                    {isValidValue(tenderProfile.contractTerm?.totalPossibleTerm) && <div className="flex justify-between"><span className="text-gray-400">Total Possible</span><span className="text-white font-semibold">{tenderProfile.contractTerm.totalPossibleTerm}</span></div>}
                    {isValidValue(analysis.tenderSummary?.contractDuration || tenderProfile.contractDuration) && <div className="flex justify-between"><span className="text-gray-400">Duration</span><span className="text-white font-semibold">{analysis.tenderSummary?.contractDuration || tenderProfile.contractDuration}</span></div>}
                  </div>
                </div>
              </div>

              {tenderProfile.portfolioSize && (
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-6">
                  <h4 className="text-white font-semibold mb-4 flex items-center gap-2"><Building2 size={20} className="text-cyan-400" />Portfolio Size</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {isValidValue(tenderProfile.portfolioSize.buildings) && <div className="bg-white/5 rounded-lg p-4 text-center"><p className="text-2xl font-bold text-cyan-400">{tenderProfile.portfolioSize.buildings}</p><p className="text-gray-400 text-sm">Buildings</p></div>}
                    {isValidValue(tenderProfile.portfolioSize.squareMetres) && <div className="bg-white/5 rounded-lg p-4 text-center"><p className="text-2xl font-bold text-purple-400">{tenderProfile.portfolioSize.squareMetres}</p><p className="text-gray-400 text-sm">Sq Metres</p></div>}
                    {isValidValue(tenderProfile.portfolioSize.sites) && <div className="bg-white/5 rounded-lg p-4 text-center"><p className="text-2xl font-bold text-emerald-400">{tenderProfile.portfolioSize.sites}</p><p className="text-gray-400 text-sm">Sites</p></div>}
                  </div>
                  {isValidValue(tenderProfile.portfolioSize.description) && <p className="text-gray-400 text-sm mt-4">{tenderProfile.portfolioSize.description}</p>}
                </div>
              )}

              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-6">
                <h4 className="text-white font-semibold mb-4 flex items-center gap-2"><Calendar size={20} className="text-cyan-400" />Key Dates</h4>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {formatDate(keyDates.submissionDeadline) && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                      <p className="text-xs text-red-400 uppercase tracking-wider mb-1">Submission Deadline</p>
                      <p className="text-white font-semibold">{formatDate(keyDates.submissionDeadline)}</p>
                      {keyDates.daysUntilSubmission && typeof keyDates.daysUntilSubmission === 'number' && <p className="text-red-400 text-sm mt-1">{keyDates.daysUntilSubmission} days remaining</p>}
                    </div>
                  )}
                  {formatDate(keyDates.clarificationDeadline) && <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4"><p className="text-xs text-amber-400 uppercase tracking-wider mb-1">Clarification Deadline</p><p className="text-white font-semibold">{formatDate(keyDates.clarificationDeadline)}</p></div>}
                  {formatDate(keyDates.contractStartDate) && <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4"><p className="text-xs text-emerald-400 uppercase tracking-wider mb-1">Contract Start</p><p className="text-white font-semibold">{formatDate(keyDates.contractStartDate)}</p></div>}
                  {isValidValue(keyDates.siteVisitDates) && <div className="bg-white/5 rounded-lg p-4"><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Site Visits</p><p className="text-white">{keyDates.siteVisitDates}</p></div>}
                  {formatDate(keyDates.awardDate) && <div className="bg-white/5 rounded-lg p-4"><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Expected Award</p><p className="text-white">{formatDate(keyDates.awardDate)}</p></div>}
                  {isValidValue(keyDates.mobilisationPeriod) && <div className="bg-white/5 rounded-lg p-4"><p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Mobilisation</p><p className="text-white">{keyDates.mobilisationPeriod}</p></div>}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'evidence' && (
            <motion.div key="evidence" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {analysis.evidenceAnalysis && (
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 text-center">
                    <p className="text-gray-400 text-sm mb-2">Total Evidence</p><p className="text-3xl font-bold text-emerald-400">{totalEvidence}</p>
                  </div>
                  <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 rounded-xl p-5 text-center">
                    <p className="text-gray-400 text-sm mb-2">Coverage</p><p className="text-3xl font-bold text-cyan-400">{analysis.evidenceAnalysis.overallEvidenceCoverage || '—'}</p>
                  </div>
                  <div className="bg-gradient-to-br from-red-500/10 to-red-500/5 border border-red-500/20 rounded-xl p-5 text-center">
                    <p className="text-gray-400 text-sm mb-2">Gaps</p><p className="text-3xl font-bold text-red-400">{gapCount}</p>
                  </div>
                </div>
              )}
              {analysis.evidenceAnalysis?.strongAreas && analysis.evidenceAnalysis.strongAreas.length > 0 && (
                <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-6">
                  <h4 className="text-emerald-400 font-semibold mb-4 flex items-center gap-2"><CheckCircle size={20} />Strong Evidence Areas</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysis.evidenceAnalysis.strongAreas.map((area: string, i: number) => (<span key={i} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm">{area}</span>))}
                  </div>
                </div>
              )}
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-white font-semibold flex items-center gap-2"><Database size={20} className="text-purple-400" />Evidence Gap Analysis</h4>
                  <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm">{gapCount} gaps identified</span>
                </div>
                <div className="space-y-4">
                  {(Array.isArray(evidenceGaps) ? evidenceGaps : []).map((gap: any, i: number) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start gap-3">
                          <XCircle className="text-red-400 mt-0.5 shrink-0" size={18} />
                          <div><p className="text-white font-medium">{typeof gap === 'string' ? gap : gap.area || gap.gap}</p>{gap.impact && <p className="text-gray-400 text-sm mt-1">Affects: {gap.impact}</p>}</div>
                        </div>
                        {gap.severity && <span className={`px-2 py-1 rounded text-xs font-medium ${gap.severity === 'Critical' ? 'bg-red-500/20 text-red-400' : gap.severity === 'Major' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'}`}>{gap.severity}</span>}
                      </div>
                      {gap.canWeAddress && <p className="text-gray-400 text-sm mt-2 pt-2 border-t border-white/10"><span className="text-cyan-400">Can address:</span> {gap.canWeAddress}</p>}
                    </div>
                  ))}
                  {gapCount === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle className="text-emerald-400 mx-auto mb-3" size={40} />
                      <p className="text-emerald-400 font-medium">No significant evidence gaps identified</p>
                      <p className="text-gray-500 text-sm mt-1">Your evidence library covers the key requirements</p>
                    </div>
                  )}
                </div>
              </div>
              {analysis.evidenceAnalysis?.relevantCaseStudies && analysis.evidenceAnalysis.relevantCaseStudies.length > 0 && (
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-6">
                  <h4 className="text-white font-semibold mb-4 flex items-center gap-2"><Award size={20} className="text-cyan-400" />Relevant Case Studies</h4>
                  <div className="space-y-3">
                    {analysis.evidenceAnalysis.relevantCaseStudies.map((cs: any, i: number) => (
                      <div key={i} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-white font-medium">{cs.title}</p>
                          <span className={`px-2 py-1 rounded text-xs ${cs.strengthForTender === 'High' ? 'bg-emerald-500/20 text-emerald-400' : cs.strengthForTender === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'}`}>{cs.strengthForTender}</span>
                        </div>
                        {cs.relevance && <p className="text-gray-400 text-sm">{cs.relevance}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'evaluation' && (
            <motion.div key="evaluation" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-6">
                <h4 className="text-white font-semibold mb-6 flex items-center gap-2"><BarChart3 size={20} className="text-cyan-400" />Evaluation Model</h4>
                {(evaluationModel.qualityWeighting || evaluationModel.qualityWeight || evaluationModel.priceWeighting || evaluationModel.priceWeight) ? (
                  <div className="flex items-center gap-4 mb-6">
                    {(evaluationModel.qualityWeighting || evaluationModel.qualityWeight) && <div className="flex-1 bg-cyan-500/20 rounded-xl p-4"><p className="text-gray-400 text-sm">Quality</p><p className="text-3xl font-bold text-cyan-400">{evaluationModel.qualityWeighting || evaluationModel.qualityWeight}%</p></div>}
                    {(evaluationModel.priceWeighting || evaluationModel.priceWeight) && <div className="flex-1 bg-emerald-500/20 rounded-xl p-4"><p className="text-gray-400 text-sm">Price</p><p className="text-3xl font-bold text-emerald-400">{evaluationModel.priceWeighting || evaluationModel.priceWeight}%</p></div>}
                  </div>
                ) : (
                  <p className="text-gray-500 mb-4">Evaluation weightings not specified in tender documents</p>
                )}
                {evaluationModel.qualityPriceRatio && <p className="text-gray-400 text-sm mb-4">Ratio: {evaluationModel.qualityPriceRatio}</p>}
                {(evaluationModel.qualityCriteria || evaluationModel.criteria || []).length > 0 && (
                  <div className="space-y-3">
                    {(evaluationModel.qualityCriteria || evaluationModel.criteria || []).map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                        <div className="flex-1"><p className="text-white font-medium">{c.criterion || c.name}</p>{(c.evidenceGap || c.gapAnalysis) && <p className="text-gray-400 text-sm mt-1">{c.evidenceGap || c.gapAnalysis}</p>}</div>
                        <div className="flex items-center gap-4">
                          {(c.ourStrength || c.evidenceStrength) && <span className={`px-2 py-1 rounded text-xs font-medium ${(c.ourStrength || c.evidenceStrength) === 'Strong' ? 'bg-emerald-500/20 text-emerald-400' : (c.ourStrength || c.evidenceStrength) === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{c.ourStrength || c.evidenceStrength}</span>}
                          {(c.weighting || c.weight) && <span className="text-cyan-400 font-bold">{c.weighting || c.weight}%</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {analysis.competitivePosition && (
                <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-6">
                  <h4 className="text-white font-semibold mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-cyan-400" />Competitive Position</h4>
                  <div className="grid md:grid-cols-2 gap-6">
                    {analysis.competitivePosition.ourDifferentiators && (
                      <div><p className="text-emerald-400 font-medium mb-2">Our Differentiators</p>
                        <ul className="space-y-2">{analysis.competitivePosition.ourDifferentiators.map((d: string, i: number) => (<li key={i} className="flex items-start gap-2 text-gray-300 text-sm"><CheckCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" />{d}</li>))}</ul>
                      </div>
                    )}
                    {analysis.competitivePosition.competitiveThreats && (
                      <div><p className="text-amber-400 font-medium mb-2">Competitive Threats</p>
                        <ul className="space-y-2">{analysis.competitivePosition.competitiveThreats.map((t: string, i: number) => (<li key={i} className="flex items-start gap-2 text-gray-300 text-sm"><AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />{t}</li>))}</ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'compliance' && (
            <motion.div key="compliance" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-white font-semibold flex items-center gap-2"><Shield size={20} className="text-cyan-400" />Mandatory Requirements</h4>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${complianceStatus === 'pass' || complianceStatus === 'met' ? 'bg-emerald-500/20 text-emerald-400' : complianceStatus === 'at risk' || complianceStatus === 'risk' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                    {complianceStatus === 'pass' || complianceStatus === 'met' ? 'All Clear' : complianceStatus === 'at risk' || complianceStatus === 'risk' ? 'At Risk' : 'Gaps Found'}
                  </span>
                </div>
                <div className="space-y-3">
                  {(analysis.mandatoryRequirements?.requirements || analysis.mandatoryCompliance?.requirements || []).map((req: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div className="flex items-start gap-3">
                        {(req.status === 'met' || req.status === 'MET') ? <CheckCircle className="text-emerald-400 mt-0.5 shrink-0" size={18} /> : (req.status === 'partial' || req.status === 'PARTIAL') ? <AlertTriangle className="text-amber-400 mt-0.5 shrink-0" size={18} /> : <XCircle className="text-red-400 mt-0.5 shrink-0" size={18} />}
                        <div>
                          <p className="text-white font-medium">{req.requirement}</p>
                          {req.threshold && <p className="text-gray-500 text-xs mt-0.5">Required: {req.threshold}</p>}
                          {(req.ourPosition || req.evidence) && <p className="text-gray-400 text-sm mt-1">{req.ourPosition || req.evidence}</p>}
                          {req.action && <p className="text-cyan-400 text-sm mt-1">Action: {req.action}</p>}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${(req.status === 'met' || req.status === 'MET') ? 'bg-emerald-500/20 text-emerald-400' : (req.status === 'partial' || req.status === 'PARTIAL') ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>{req.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'risks' && (
            <motion.div key="risks" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-white font-semibold flex items-center gap-2"><AlertTriangle size={20} className="text-amber-400" />Risk Assessment</h4>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${(analysis.riskAssessment?.overallRisk || analysis.riskAssessment?.overallRiskRating) === 'Low' ? 'bg-emerald-500/20 text-emerald-400' : (analysis.riskAssessment?.overallRisk || analysis.riskAssessment?.overallRiskRating) === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                    {analysis.riskAssessment?.overallRisk || analysis.riskAssessment?.overallRiskRating || 'Medium'} Risk
                  </span>
                </div>
                <div className="space-y-3">
                  {(analysis.riskAssessment?.risks || []).map((risk: any, i: number) => (
                    <div key={i} className="p-4 bg-white/5 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div><span className="text-gray-400 text-xs uppercase tracking-wider">{risk.category}</span><p className="text-white font-medium mt-1">{risk.risk}</p></div>
                        <div className="flex items-center gap-2">
                          {risk.likelihood && <span className="text-gray-500 text-xs">L: {risk.likelihood}</span>}
                          <span className={`px-2 py-1 rounded text-xs font-medium ${(risk.severity || risk.impact) === 'High' ? 'bg-red-500/20 text-red-400' : (risk.severity || risk.impact) === 'Medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>{risk.severity || risk.impact}</span>
                        </div>
                      </div>
                      {risk.mitigation && <p className="text-gray-400 text-sm mt-2 pt-2 border-t border-white/10"><span className="text-cyan-400">Mitigation:</span> {risk.mitigation}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
