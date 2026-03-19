'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check, Send, Database, PenTool, BarChart3, Target, Zap } from 'lucide-react';

type QuestionType = 'scale' | 'nps' | 'choice' | 'text' | 'yesno';

interface Question {
  id: string;
  section: string;
  sectionIcon: any;
  sectionColor: string;
  question: string;
  type: QuestionType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

const questions: Question[] = [
  // BidVault
  { id: 'vault_findability', section: 'BidVault', sectionIcon: Database, sectionColor: 'purple', question: 'How easy was it to find relevant evidence for your responses?', type: 'scale', required: true },
  { id: 'vault_categories', section: 'BidVault', sectionIcon: Database, sectionColor: 'purple', question: 'Did the evidence categories make sense for your business?', type: 'choice', options: ['Yes, perfect', 'Mostly yes', 'Partially', 'Not really', 'No'], required: true },
  { id: 'vault_confidence', section: 'BidVault', sectionIcon: Database, sectionColor: 'purple', question: 'How confident are you that the evidence used in responses is accurate?', type: 'scale', required: true },
  { id: 'vault_missing', section: 'BidVault', sectionIcon: Database, sectionColor: 'purple', question: 'What evidence types were missing that you needed?', type: 'text', placeholder: 'e.g. specific certifications, case study formats, CVs...' },
  { id: 'vault_comparison', section: 'BidVault', sectionIcon: Database, sectionColor: 'purple', question: 'How does BidVault compare to how you stored evidence before?', type: 'choice', options: ['Much better', 'Somewhat better', 'About the same', 'Somewhat worse', 'Much worse', "We didn't store evidence before"], required: true },

  // BidWrite
  { id: 'write_quality', section: 'BidWrite', sectionIcon: PenTool, sectionColor: 'cyan', question: 'How would you rate the quality of first-draft responses?', type: 'scale', required: true },
  { id: 'write_kept', section: 'BidWrite', sectionIcon: PenTool, sectionColor: 'cyan', question: 'What percentage of the AI response did you typically keep vs rewrite?', type: 'choice', options: ['Kept 75-100%', 'Kept 50-75%', 'Kept 25-50%', 'Kept 0-25%'], required: true },
  { id: 'write_timesaved', section: 'BidWrite', sectionIcon: PenTool, sectionColor: 'cyan', question: 'How much time did BidWrite save you per question?', type: 'choice', options: ['Massive saving (hours → minutes)', 'Significant saving', 'Some saving', 'Minimal saving', 'No saving'], required: true },
  { id: 'write_tailored', section: 'BidWrite', sectionIcon: PenTool, sectionColor: 'cyan', question: 'Did responses feel generic or tailored to your company?', type: 'choice', options: ['Very tailored to us', 'Mostly tailored', 'Mix of both', 'Mostly generic', 'Very generic'], required: true },
  { id: 'write_unusable', section: 'BidWrite', sectionIcon: PenTool, sectionColor: 'cyan', question: 'Were there any responses that were unusable? If yes, what was wrong?', type: 'text', placeholder: 'Describe any issues, or type "None" if all responses were usable...' },

  // Scoring (built into BidWrite)
  { id: 'score_accuracy', section: 'Scoring', sectionIcon: BarChart3, sectionColor: 'emerald', question: 'How accurate did the scores feel compared to your own judgement?', type: 'scale', required: true },
  { id: 'score_actionable', section: 'Scoring', sectionIcon: BarChart3, sectionColor: 'emerald', question: 'Were the improvement suggestions actionable?', type: 'choice', options: ['Yes, very actionable', 'Mostly actionable', 'Sometimes actionable', 'Rarely actionable', 'Not actionable'], required: true },
  { id: 'score_changed', section: 'Scoring', sectionIcon: BarChart3, sectionColor: 'emerald', question: 'Did you change any responses based on the scoring feedback?', type: 'yesno', required: true },
  { id: 'score_trust', section: 'Scoring', sectionIcon: BarChart3, sectionColor: 'emerald', question: 'Did higher-scored responses actually feel stronger to you?', type: 'choice', options: ['Yes, definitely', 'Mostly yes', 'Mixed', 'Not really', 'No'], required: true },

  // BidGate
  { id: 'gate_instinct', section: 'BidGate', sectionIcon: Target, sectionColor: 'amber', question: 'Did the go/no-go analysis match your gut instinct?', type: 'choice', options: ['Yes, spot on', 'Mostly matched', 'Partly matched', "Didn't match", "Didn't use BidGate"], required: true },
  { id: 'gate_gaps', section: 'BidGate', sectionIcon: Target, sectionColor: 'amber', question: "Did it surface any gaps you hadn't considered?", type: 'yesno' },
  { id: 'gate_useit', section: 'BidGate', sectionIcon: Target, sectionColor: 'amber', question: 'Would you use BidGate to decide whether to bid in future?', type: 'choice', options: ['Definitely', 'Probably', 'Maybe', 'Probably not', 'Definitely not'], required: true },

  // Overall
  { id: 'overall_nps', section: 'Overall', sectionIcon: Zap, sectionColor: 'pink', question: 'How likely are you to recommend BidEngine to a colleague?', type: 'nps', required: true },
  { id: 'overall_pay', section: 'Overall', sectionIcon: Zap, sectionColor: 'pink', question: 'If BidEngine cost £495/month, would you pay for it?', type: 'choice', options: ['Definitely', 'Probably', 'Probably not', 'Definitely not'], required: true },
  { id: 'overall_paydriver', section: 'Overall', sectionIcon: Zap, sectionColor: 'pink', question: "What's the single biggest thing that would make you more likely to pay?", type: 'text', placeholder: 'Be honest — this helps us prioritise...', required: true },
  { id: 'overall_giveup', section: 'Overall', sectionIcon: Zap, sectionColor: 'pink', question: 'What nearly made you give up during the trial?', type: 'text', placeholder: 'Any friction points, confusing bits, or frustrations...' },
  { id: 'overall_surprise', section: 'Overall', sectionIcon: Zap, sectionColor: 'pink', question: 'What surprised you most (good or bad)?', type: 'text', placeholder: 'We love honest feedback...' },
  { id: 'overall_miss', section: 'Overall', sectionIcon: Zap, sectionColor: 'pink', question: "If BidEngine didn't exist tomorrow, what would you miss most?", type: 'text', placeholder: "This tells us what's actually valuable to you...", required: true },
];

const sectionColors: Record<string, string> = {
  purple: 'from-purple-500 to-purple-600',
  cyan: 'from-cyan-500 to-blue-500',
  emerald: 'from-emerald-500 to-emerald-600',
  amber: 'from-amber-500 to-orange-500',
  pink: 'from-pink-500 to-rose-500',
};

const sectionBgColors: Record<string, string> = {
  purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
  cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  pink: 'bg-pink-500/10 border-pink-500/30 text-pink-400',
};

export default function FeedbackSurvey() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const currentAnswer = answers[currentQuestion?.id];

  const canProceed = () => {
    if (!currentQuestion.required) return true;
    const answer = answers[currentQuestion.id];
    if (answer === undefined || answer === null || answer === '') return false;
    return true;
  };

  const handleAnswer = (value: any) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    
    const payload = {
      timestamp: new Date().toISOString(),
      ...answers
    };

    try {
      await fetch('https://bidengine.app.n8n.cloud/webhook/7e8b117f-b8cf-40aa-b1b5-7a884518eedb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error('Webhook error:', err);
    }
    
    setSubmitted(true);
    setSubmitting(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && canProceed()) {
      if (currentQuestion.type === 'text' && !e.ctrlKey) return;
      if (currentIndex === questions.length - 1) {
        handleSubmit();
      } else {
        handleNext();
      }
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Thank you!</h1>
          <p className="text-gray-400 mb-8">
            Your feedback is incredibly valuable. It'll directly shape how we build BidEngine going forward.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            Back to BidEngine
          </a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <svg width="160" height="40" viewBox="0 0 200 50" style={{filter: 'drop-shadow(0 0 15px rgba(0,212,255,0.5))'}}>
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00d4ff"/>
                <stop offset="50%" stopColor="#a855f7"/>
                <stop offset="100%" stopColor="#ec4899"/>
              </linearGradient>
            </defs>
            <text x="0" y="33" fontFamily="system-ui, -apple-system, sans-serif" fontSize="26" fontWeight="800" fill="url(#logoGrad)" letterSpacing="-1">BIDENGINE</text>
          </svg>
          <span className="text-gray-500 text-sm">Customer Feedback</span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Section Badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-6 ${sectionBgColors[currentQuestion.sectionColor]}`}>
                <currentQuestion.sectionIcon size={14} />
                <span className="text-sm font-medium">{currentQuestion.section}</span>
              </div>

              {/* Question */}
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                {currentQuestion.question}
              </h2>
              
              {/* Question number */}
              <p className="text-gray-500 text-sm mb-8">
                Question {currentIndex + 1} of {questions.length}
                {currentQuestion.required && <span className="text-pink-400 ml-1">*</span>}
              </p>

              {/* Answer Input */}
              <div className="mb-8">
                {/* Scale 1-10 */}
                {currentQuestion.type === 'scale' && (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <button
                        key={n}
                        onClick={() => handleAnswer(n)}
                        className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
                          currentAnswer === n
                            ? `bg-gradient-to-r ${sectionColors[currentQuestion.sectionColor]} text-white`
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}

                {/* NPS 0-10 */}
                {currentQuestion.type === 'nps' && (
                  <div>
                    <div className="flex gap-2 mb-2">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <button
                          key={n}
                          onClick={() => handleAnswer(n)}
                          className={`flex-1 py-4 rounded-xl font-bold text-lg transition-all ${
                            currentAnswer === n
                              ? n <= 6 ? 'bg-red-500 text-white' : n <= 8 ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 px-1">
                      <span>Not likely</span>
                      <span>Very likely</span>
                    </div>
                  </div>
                )}

                {/* Single Choice */}
                {currentQuestion.type === 'choice' && currentQuestion.options && (
                  <div className="space-y-3">
                    {currentQuestion.options.map(option => (
                      <button
                        key={option}
                        onClick={() => handleAnswer(option)}
                        className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-3 ${
                          currentAnswer === option
                            ? `bg-gradient-to-r ${sectionColors[currentQuestion.sectionColor]} text-white`
                            : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          currentAnswer === option ? 'border-white bg-white/20' : 'border-gray-500'
                        }`}>
                          {currentAnswer === option && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <span>{option}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Yes/No */}
                {currentQuestion.type === 'yesno' && (
                  <div className="flex gap-4">
                    {['Yes', 'No'].map(option => (
                      <button
                        key={option}
                        onClick={() => handleAnswer(option)}
                        className={`flex-1 p-4 rounded-xl font-medium text-lg transition-all ${
                          currentAnswer === option
                            ? option === 'Yes' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {/* Text */}
                {currentQuestion.type === 'text' && (
                  <textarea
                    value={currentAnswer || ''}
                    onChange={(e) => handleAnswer(e.target.value)}
                    placeholder={currentQuestion.placeholder}
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all min-h-[120px] resize-none"
                    autoFocus
                  />
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={20} />
                  Back
                </button>

                {currentIndex === questions.length - 1 ? (
                  <button
                    onClick={handleSubmit}
                    disabled={!canProceed() || submitting}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <>Submitting...</>
                    ) : (
                      <>
                        Submit Feedback
                        <Send size={18} />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    disabled={!canProceed()}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                    <ChevronRight size={18} />
                  </button>
                )}
              </div>

              {/* Keyboard hint */}
              <p className="text-center text-gray-600 text-xs mt-6">
                Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-gray-400">Enter ↵</kbd> to continue
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-4">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-gray-600 text-xs">
            Your feedback shapes BidEngine. Thank you for taking the time.
          </p>
        </div>
      </footer>
    </div>
  );
}
