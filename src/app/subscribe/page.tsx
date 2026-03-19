'use client';

import { useState, useEffect, useRef } from 'react';
import { useUser, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Zap, Target, TrendingUp, Shield, FileCheck, ChevronRight } from 'lucide-react';

// Animated counter hook
function useCountUp(end: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
    }
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [hasStarted, startOnView]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, hasStarted]);

  return { count, ref };
}

// Countdown hook (for time falling)
function useCountDown(start: number, end: number, duration: number = 2000) {
  const [count, setCount] = useState(start);
  const [hasStarted, setHasStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    let startTime: number;
    let animationFrame: number;
    const range = start - end;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing - fast at start, slows down dramatically at end
      const easeOut = 1 - Math.pow(1 - progress, 4);
      setCount(Math.round(start - (easeOut * range)));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [start, end, duration, hasStarted]);

  return { count, ref };
}

// Animated Stats Component
function AnimatedStats() {
  const q = useCountUp(48, 10000);
  const elements = useCountUp(96, 10000);
  const seconds = useCountDown(120, 6, 10000); // Falls from 120s to 6s
  const minutes = useCountDown(180, 10, 10000); // Falls from 180 min to 10 min
  const score = useCountUp(85, 10000); // 8.5 * 10
  const faster = useCountUp(500, 10000);

  return (
    <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-2xl p-8 mb-12">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-white mb-2">Real Results. Real Tender.</h2>
        <p className="text-gray-400">48-question public sector tender — completed in 10 minutes</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <div ref={q.ref} className="text-center p-4 bg-black/30 rounded-xl">
          <div className="text-2xl font-bold text-cyan-400">{q.count}</div>
          <p className="text-gray-500 text-xs">Questions</p>
        </div>
        <div ref={elements.ref} className="text-center p-4 bg-black/30 rounded-xl">
          <div className="text-2xl font-bold text-purple-400">{elements.count}</div>
          <p className="text-gray-500 text-xs">Scored Elements</p>
        </div>
        <div ref={seconds.ref} className="text-center p-4 bg-black/30 rounded-xl">
          <div className="text-2xl font-bold text-pink-400">{seconds.count}s</div>
          <p className="text-gray-500 text-xs">Per Response</p>
        </div>
        <div ref={minutes.ref} className="text-center p-4 bg-black/30 rounded-xl">
          <div className="text-2xl font-bold text-amber-400">{minutes.count} min</div>
          <p className="text-gray-500 text-xs">Total Time</p>
        </div>
        <div ref={score.ref} className="text-center p-4 bg-black/30 rounded-xl">
          <div className="text-2xl font-bold text-emerald-400">{(score.count / 10).toFixed(1)}/10</div>
          <p className="text-gray-500 text-xs">Avg Score</p>
        </div>
        <div ref={faster.ref} className="text-center p-4 bg-black/30 rounded-xl">
          <div className="text-2xl font-bold text-cyan-400">{faster.count}x</div>
          <p className="text-gray-500 text-xs">Faster</p>
        </div>
      </div>
    </div>
  );
}

export default function SubscribePage() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canceled = searchParams.get('canceled');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showCompanyInput, setShowCompanyInput] = useState(false);
  
  // Check for stored company name on mount
  useEffect(() => {
    const stored = localStorage.getItem('pendingCompanyName');
    if (stored) {
      setCompanyName(stored);
    }
  }, []);
  
  // ROI Calculator state - shows their potential gain
  const [tendersPerYear, setTendersPerYear] = useState(25);
  const [avgContractValue, setAvgContractValue] = useState(150000);
  const [currentWinRate, setCurrentWinRate] = useState(20);
  
  // Calculations - focus on their gains, not our cost
  const currentWins = Math.round(tendersPerYear * (currentWinRate / 100));
  const improvedWinRate = Math.min(currentWinRate + 15, 85);
  const newWins = Math.round(tendersPerYear * (improvedWinRate / 100));
  const additionalWins = newWins - currentWins;
  const additionalRevenue = additionalWins * avgContractValue;

  const handleSubscribe = async () => {
    if (!user) {
      router.push('/sign-up?redirect_url=/subscribe');
      return;
    }

    // If no company name, show the input modal
    if (!companyName.trim()) {
      setShowCompanyInput(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Store company name for later use
      localStorage.setItem('pendingCompanyName', companyName.trim());
      
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.emailAddresses[0]?.emailAddress || '',
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses[0]?.emailAddress || '',
          companyName: companyName.trim(),
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        router.push('/sign-up?redirect_url=/subscribe');
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to create checkout session');
        setLoading(false);
      }
    } catch (err) {
      console.error('Subscribe error:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      
      {/* Company Name Modal */}
      {showCompanyInput && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-8 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-2">One more thing...</h3>
            <p className="text-gray-400 text-sm mb-6">What's your company name? This will appear on your dashboard and exports.</p>
            
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter your company name"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && companyName.trim()) {
                  setShowCompanyInput(false);
                  handleSubscribe();
                }
              }}
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowCompanyInput(false)}
                className="flex-1 py-3 bg-white/5 text-gray-400 font-medium rounded-xl hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (companyName.trim()) {
                    setShowCompanyInput(false);
                    handleSubscribe();
                  }
                }}
                disabled={!companyName.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <svg width="200" height="50" viewBox="0 0 200 50" className="drop-shadow-[0_0_15px_rgba(0,212,255,0.5)]">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00d4ff"/>
                  <stop offset="50%" stopColor="#a855f7"/>
                  <stop offset="100%" stopColor="#ec4899"/>
                </linearGradient>
                <linearGradient id="iconGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00d4ff"/>
                  <stop offset="100%" stopColor="#7c3aed"/>
                </linearGradient>
              </defs>
              <g>
                <path d="M8 8L22 4L28 25L22 46L8 42V8Z" fill="url(#iconGrad)" opacity="0.9"/>
                <path d="M22 4L36 12L32 25L36 38L22 46L28 25L22 4Z" fill="url(#logoGrad)" opacity="0.8"/>
                <path d="M28 25L40 20L40 30L28 25Z" fill="#00d4ff"/>
              </g>
              <text x="48" y="33" fontFamily="system-ui, -apple-system, sans-serif" fontSize="26" fontWeight="800" fill="url(#logoGrad)" letterSpacing="-1">BIDENGINE</text>
            </svg>
          </Link>
          <div className="flex items-center gap-4">
            <SignedOut>
              <Link href="/sign-in" className="text-gray-400 hover:text-white transition-colors">Sign In</Link>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-12">
        
        {/* HERO */}
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-full text-cyan-400 text-sm font-medium mb-6">
            🚀 AI-POWERED BID WRITING — EVIDENCE-BACKED, NOT GUESSWORK
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            Write Winning Bids in{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">Minutes</span>
            <br />
            <span className="text-gray-500">Not Weeks</span>
          </h1>
          
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-4">
            Generate compliant, evidence-backed answers in minutes — <span className="text-cyan-400">with citations, not guesswork</span>.
          </p>
          
          <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-6">
            Every response grounded in your real evidence. Zero fabricated claims. Just winning answers.
          </p>
          
          <a 
            href="https://demo.bidengine.co" 
            target="_blank"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            Book a Demo →
          </a>
        </div>

        {/* HOW IT WORKS - 3 Step Flow */}
        <div className="mb-16">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">1</div>
              <span className="text-gray-300">Upload tender</span>
            </div>
            <ChevronRight className="text-gray-600 hidden md:block" size={20} />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 font-bold">2</div>
              <span className="text-gray-300">Upload evidence</span>
            </div>
            <ChevronRight className="text-gray-600 hidden md:block" size={20} />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">3</div>
              <span className="text-gray-300">Generate answers with citations</span>
            </div>
          </div>
        </div>

        {/* EVIDENCE-BASED PROMISE */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/30 rounded-2xl p-8 mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileCheck className="text-emerald-400" size={28} />
            <h2 className="text-2xl font-semibold text-white">100% Evidence-Based. Zero Hallucinations.</h2>
          </div>
          <p className="text-center text-emerald-400/80 mb-6 font-medium">
            If it's not in your evidence library, it doesn't go in your bid.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div className="p-4">
              <div className="text-emerald-400 font-semibold mb-2">Every claim traceable</div>
              <p className="text-gray-400 text-sm">Responses link directly to your uploaded evidence — case studies, CVs, certifications</p>
            </div>
            <div className="p-4">
              <div className="text-emerald-400 font-semibold mb-2">No made-up statistics</div>
              <p className="text-gray-400 text-sm">BidEngine only uses data you've provided. If it's not in your vault, it's not in your bid</p>
            </div>
            <div className="p-4">
              <div className="text-emerald-400 font-semibold mb-2">Evaluator-ready output</div>
              <p className="text-gray-400 text-sm">Responses structured for how procurement teams actually score submissions</p>
            </div>
          </div>
        </div>

        {/* SPEED STATS - Animated */}
        <AnimatedStats />

        {/* MODULES */}
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-white mb-2 text-center">Four Modules. Complete Coverage.</h2>
          <p className="text-gray-400 text-center mb-8">Every response grounded in your actual evidence.</p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* BidVault */}
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                  <Shield className="text-purple-400" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-purple-400">BidVault</h3>
                  <p className="text-gray-400 text-sm">Evidence Library</p>
                </div>
              </div>
              <p className="text-gray-300 text-sm">Your delivery history — case studies, CVs, accreditations, KPIs — categorised and searchable. Every response pulls from verified evidence.</p>
            </div>

            {/* BidGate */}
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Target className="text-amber-400" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-amber-400">BidGate</h3>
                  <p className="text-gray-400 text-sm">Go/No-Go Analysis</p>
                </div>
              </div>
              <p className="text-gray-300 text-sm">Know in 30 seconds if you should bid. See evidence gaps and win probability before committing resource.</p>
            </div>

            {/* BidWrite */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center">
                  <Zap className="text-cyan-400" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-cyan-400">BidWrite</h3>
                  <p className="text-gray-400 text-sm">AI Response Generation</p>
                </div>
              </div>
              <p className="text-gray-300 text-sm">Upload the tender. We extract every question, generate evidence-backed responses, auto-score against procurement criteria, and improve until excellent. If it's not in your vault, it's not in your response.</p>
            </div>
          </div>
        </div>

        {/* ROI CALCULATOR - Shows their potential gain */}
        <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-8 mb-12">
          <h2 className="text-2xl font-semibold text-white text-center mb-2">What Could BidEngine Mean For You?</h2>
          <p className="text-gray-400 text-center mb-8">Adjust the sliders to see your potential</p>
          
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* Slider 1 */}
            <div>
              <label className="block text-gray-300 mb-2 text-sm">Tenders per year</label>
              <input 
                type="range" 
                min="5" 
                max="100" 
                value={tendersPerYear}
                onChange={(e) => setTendersPerYear(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="text-2xl font-bold text-cyan-400 mt-2">{tendersPerYear}</div>
            </div>
            
            {/* Slider 2 */}
            <div>
              <label className="block text-gray-300 mb-2 text-sm">Average contract value</label>
              <input 
                type="range" 
                min="50000" 
                max="1000000" 
                step="10000"
                value={avgContractValue}
                onChange={(e) => setAvgContractValue(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="text-2xl font-bold text-purple-400 mt-2">£{(avgContractValue/1000).toFixed(0)}k</div>
            </div>
            
            {/* Slider 3 */}
            <div>
              <label className="block text-gray-300 mb-2 text-sm">Current win rate</label>
              <input 
                type="range" 
                min="5" 
                max="75" 
                value={currentWinRate}
                onChange={(e) => setCurrentWinRate(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="text-2xl font-bold text-amber-400 mt-2">{currentWinRate}%</div>
            </div>
          </div>
          
          {/* Results - Focus on THEIR gains */}
          <div className="grid md:grid-cols-3 gap-4 p-6 bg-black/40 rounded-xl">
            <div className="text-center">
              <p className="text-gray-500 text-xs mb-1">Current wins/year</p>
              <div className="text-2xl font-bold text-gray-400">{currentWins}</div>
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-xs mb-1">With +15% win rate</p>
              <div className="text-2xl font-bold text-emerald-400">{newWins}</div>
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-xs mb-1">Additional revenue potential</p>
              <div className="text-2xl font-bold text-cyan-400">£{(additionalRevenue/1000).toFixed(0)}k</div>
            </div>
          </div>
          
          <p className="text-center text-gray-400 mt-6">
            Win just <span className="text-emerald-400 font-semibold">{additionalWins} more bid{additionalWins !== 1 ? 's' : ''}</span> per year.
            <a href="https://demo.bidengine.co" target="_blank" className="text-cyan-400 hover:text-cyan-300 ml-1">Book a demo</a> and we'll show you how.
          </p>
        </div>

        {/* CTA - Demo Focused */}
        <div className="mb-12" id="pricing">
          <h2 className="text-2xl font-semibold text-white text-center mb-2">See It In Action</h2>
          <p className="text-gray-400 text-center mb-8">15 minutes. Watch a real tender processed. No slides, no fluff.</p>
          
          <div className="max-w-md mx-auto">
            <div className="relative group">
              {/* Gradient border effect */}
              <div className="absolute -inset-[1px] bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-2xl opacity-75 group-hover:opacity-100 transition-opacity blur-sm"></div>
              
              {/* Card */}
              <div className="relative bg-[#0a0a0a] rounded-2xl p-8">
                {/* Header */}
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-white mb-1">BidEngine Pro</h3>
                  <p className="text-gray-500 text-sm">Full platform access</p>
                </div>
                
                {/* Features */}
                <div className="space-y-3 mb-6">
                  {[
                    'All 4 modules included',
                    'Unlimited tenders',
                    'Unlimited questions',
                    'Full evidence library',
                    'Word & PDF export',
                    'Priority support',
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <Check size={12} className="text-white" />
                      </div>
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
                
                {/* Trust markers */}
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-6">
                  <span>✓ GDPR compliant</span>
                  <span>✓ Data isolated</span>
                  <span>✓ No AI training on your data</span>
                </div>
                
                {/* CTA Button */}
                <a
                  href="https://demo.bidengine.co"
                  target="_blank"
                  className="block w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all text-center"
                >
                  Book a Demo →
                </a>
                <p className="text-center text-gray-500 text-xs mt-3">
                  No commitment • See if it fits
                </p>
              </div>
            </div>
          </div>
          
          {error && (
            <p className="text-red-400 text-center mt-4">{error}</p>
          )}
        </div>

        {/* WHAT'S INCLUDED */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">Everything Included</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              'Unlimited tenders',
              'Unlimited questions',
              'Full evidence library',
              'AI response generation',
              'Pre-submission scoring',
              'Go/no-go analysis',
              'Word & PDF export',
              'Priority support',
              'All 4 modules',
              'All future updates',
              'Enterprise-grade security',
              '256-bit encryption',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-gray-300">
                <Check className="text-emerald-400 shrink-0" size={16} />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CREDIBILITY */}
        <div className="text-center mb-12 p-8 bg-white/5 rounded-2xl">
          <p className="text-gray-300 mb-4">
            Built from <span className="text-white font-semibold">30+ years</span> of real bid writing in FM, infrastructure, and public sector.
          </p>
          <p className="text-gray-500 mb-6 text-sm">
            This isn't a generic AI tool. It's built by people who've lost bids, won bids, and know exactly why.
          </p>
          <div className="flex items-center justify-center gap-8 text-gray-500 text-sm">
            <span>🔒 256-bit Encryption</span>
            <span>☁️ Enterprise Cloud</span>
            <span>✓ GDPR Compliant</span>
          </div>
        </div>

        {/* FINAL CTA */}
        <div className="text-center py-12 border-t border-white/10">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Replace 40–80 hours of bid writing with minutes.
          </h2>
          <p className="text-lg text-gray-400 mb-8">
            Start your free trial and upload your first tender today.
          </p>
          <a 
            href="#pricing"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all"
          >
            Start Free Trial
            <ChevronRight size={20} />
          </a>
          <a 
            href="https://demo.bidengine.co" 
            target="_blank"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white/5 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors ml-4"
          >
            See it in action →
          </a>
          <p className="text-gray-500 text-sm mt-4">Upload your first tender in 5 minutes</p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="flex justify-center gap-6 text-sm text-gray-500">
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <a href="https://docs.bidengine.co" target="_blank" className="hover:text-white">Help</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
