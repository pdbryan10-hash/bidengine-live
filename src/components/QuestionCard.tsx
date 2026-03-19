'use client';

import { motion } from 'framer-motion';
import { ChevronRight, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { TenderQuestion } from '@/types';
import { parseEvaluation, getScoreColor } from '@/lib/bubble';

interface QuestionCardProps {
  question: TenderQuestion;
  index: number;
  onClick: () => void;
}

export function QuestionCard({ question, index, onClick }: QuestionCardProps) {
  const { score } = parseEvaluation(question.final_evaluation || '');
  const hasAnswer = question.answer_text && question.answer_text.length > 10;
  const wordCount = question.answer_text ? question.answer_text.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onClick}
      className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] rounded-xl p-4 cursor-pointer border border-white/10 hover:border-cyan-500/30 transition-all group"
    >
      <div className="flex items-center gap-4">
        <div 
          className="w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm"
          style={{ 
            background: score > 0 ? `${getScoreColor(score)}20` : 'rgba(255,255,255,0.1)',
            color: score > 0 ? getScoreColor(score) : '#6b7280'
          }}
        >
          {score > 0 ? score.toFixed(1) : '-'}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-cyan-400 text-xs font-medium">{question.question_number}</span>
            {question.section && <span className="text-gray-600 text-xs">· {question.section}</span>}
          </div>
          <p className="text-gray-200 font-medium truncate">{question.question_text}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            {hasAnswer ? (
              <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-400" />{wordCount} words</span>
            ) : (
              <span className="flex items-center gap-1"><Clock size={12} className="text-amber-400" />Pending</span>
            )}
            {score > 0 && score < 7 && (
              <span className="flex items-center gap-1 text-red-400"><AlertTriangle size={12} />Needs attention</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {question.status === 'final' && (
            <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">Final</span>
          )}
          <ChevronRight className="text-gray-600 group-hover:text-cyan-400 transition-colors" size={20} />
        </div>
      </div>
    </motion.div>
  );
}
