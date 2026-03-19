'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchClientByClerkId } from '@/lib/bubble';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoaded && user && !checking) {
      setChecking(true);
      fetchClientByClerkId(user.id).then(client => {
        if (client) {
          // Check subscription status (handle both cases)
          const status = client.subscription_status || (client as any).Subscription_status;
          console.log('Client found:', client._id, 'Status:', status);
          
          // Allow if active, trialing, or no status set (existing users)
          if (status === 'active' || status === 'trialing' || !status) {
            router.push(`/v/${client._id}`);
          } else if (status === 'expired' || status === 'past_due' || status === 'canceled') {
            // Subscription expired - send to subscribe page
            router.push('/subscribe');
          } else {
            // Unknown status - let them in
            router.push(`/v/${client._id}`);
          }
        } else {
          // No client record - send to subscribe to create one
          router.push('/subscribe');
        }
      });
    }
  }, [isLoaded, user, router, checking]);

  const modules = [
    {
      name: 'BidVault',
      tagline: 'Stop guessing',
      detail: 'A single, structured source of truth for your delivery evidence. Case studies, accreditations, CVs, certifications — categorised, searchable, and enforced. Every response draws only from verified material.',
      logo: '/bidvault-logo.svg',
      color: 'purple'
    },
    {
      name: 'BidGate',
      tagline: 'Know before you start',
      detail: 'Go/no-go in 30 seconds. See evidence gaps and win probability before committing resource. Stop chasing unwinnable work.',
      logo: '/bidgate-logo.svg',
      color: 'amber'
    },
    {
      name: 'BidWrite',
      tagline: 'Replace first drafts',
      detail: 'Upload the tender. We extract every question and sub-question, then generate compliant, evidence-backed responses in minutes — not days. No generic fluff. No fabricated claims. Auto-scored and improved until excellent.',
      logo: '/bidwrite-logo.svg',
      color: 'cyan'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { text: string; border: string; bg: string }> = {
      purple: { text: 'text-purple-400', border: 'border-purple-500/30', bg: 'from-purple-500/10 to-purple-500/5' },
      amber: { text: 'text-amber-400', border: 'border-amber-500/30', bg: 'from-amber-500/10 to-amber-500/5' },
      cyan: { text: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'from-cyan-500/10 to-cyan-500/5' },
      emerald: { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'from-emerald-500/10 to-emerald-500/5' },
    };
    return colors[color] || colors.cyan;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
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
          
          <div className="flex items-center gap-4">
            <a href="https://hello.bidengine.co" target="_blank" className="text-gray-400 hover:text-white transition-colors text-sm">
              About
            </a>
            <a href="https://docs.bidengine.co" target="_blank" className="text-gray-400 hover:text-white transition-colors text-sm">
              Help
            </a>
            <SignedOut>
              <a href="/sign-in" className="text-gray-400 hover:text-white transition-colors">Sign In</a>
              <a href="/sign-up" className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity">
                Get Started
              </a>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-[1200px] mx-auto px-6 pt-20 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              From weeks of bid writing to{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                minutes of proof.
              </span>
            </h1>
            <p className="text-xl text-gray-400 mb-4 max-w-3xl">
              The only bid platform that tells you exactly how to win — then helps you do it.
            </p>
            <p className="text-lg text-gray-500">
              Evidence-backed. Evaluator-ready. Built by people who've won.
            </p>
            
            <div className="flex flex-wrap gap-4 mt-8">
              <a 
                href="/sign-up" 
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
              >
                Get Started →
              </a>
              <a 
                href="https://demo.bidengine.co" 
                target="_blank"
                className="px-6 py-3 bg-white/5 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors"
              >
                Book a Demo
              </a>
            </div>
            
            <SignedIn>
              {error ? (
                <p className="text-red-400 mt-6">{error}</p>
              ) : (
                <p className="text-gray-400 mt-6">Redirecting to your dashboard...</p>
              )}
            </SignedIn>
          </motion.div>
        </section>

        {/* Context Strip */}
        <section className="border-y border-white/10 bg-white/[0.02]">
          <div className="max-w-[1200px] mx-auto px-6 py-6">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-gray-400 text-center text-sm md:text-base"
            >
              Designed for businesses in <span className="text-white">FM</span>, <span className="text-white">infrastructure</span> and <span className="text-white">public sector</span> who want to win more contracts and grow.
            </motion.p>
          </div>
        </section>

        {/* Metrics Panel */}
        <section className="max-w-[1200px] mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-emerald-500/20 rounded-2xl blur-xl" />
              <div className="relative bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-8 md:p-10">
                <h2 className="text-center text-xl md:text-2xl font-semibold text-white mb-2">
                  From tender upload to scored responses in minutes — not weeks
                </h2>
                <p className="text-center text-gray-500 mb-10">
                  Real-world results from a live public-sector tender
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 md:gap-8">
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-cyan-400">48</div>
                    <div className="text-white text-sm font-medium mt-1">Parent questions</div>
                    <div className="text-gray-500 text-xs mt-1">Typically 2–4 weeks effort</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-purple-400">96</div>
                    <div className="text-white text-sm font-medium mt-1">Scored sub-elements</div>
                    <div className="text-gray-500 text-xs mt-1">Each individually assessed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-amber-400">10 min</div>
                    <div className="text-white text-sm font-medium mt-1">Total time</div>
                    <div className="text-gray-500 text-xs mt-1">First compliant draft</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-cyan-400">6s</div>
                    <div className="text-white text-sm font-medium mt-1">Per response</div>
                    <div className="text-gray-500 text-xs mt-1">Including evidence matching</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-emerald-400">8.5/10</div>
                    <div className="text-white text-sm font-medium mt-1">Average score</div>
                    <div className="text-gray-500 text-xs mt-1">Against real criteria</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl md:text-4xl font-bold text-purple-400">1000s</div>
                    <div className="text-white text-sm font-medium mt-1">Evidence checks</div>
                    <div className="text-gray-500 text-xs mt-1">Evidence-grounded only</div>
                  </div>
                </div>

                <p className="text-center text-gray-400 text-sm mt-10 max-w-2xl mx-auto">
                  What normally takes weeks of senior bid writing, review, and rework was produced in minutes — with every response grounded in evidence.
                </p>
              </div>
            </div>
          </motion.div>
        </section>

        {/* 21 Second Transformation Visual */}
        <section className="max-w-[1200px] mx-auto px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <h2 className="text-center text-xl md:text-2xl font-semibold text-white mb-3">
              See the 21-second transformation
            </h2>
            <p className="text-center text-gray-500 mb-8 text-sm">
              From raw tender question to evidence-backed, scored response
            </p>
            
            <div className="relative bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-6 md:p-8 overflow-hidden">
              {/* Background pulse effect */}
              <div className="absolute inset-0 overflow-hidden">
                <motion.div 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              
              <div className="relative grid md:grid-cols-[1fr,auto,1fr] gap-6 items-center">
                {/* Before - Raw Question */}
                <div className="bg-black/40 border border-white/10 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-amber-400 text-xs font-medium uppercase tracking-wide">Input</span>
                  </div>
                  <div className="space-y-3">
                    <div className="text-white text-sm font-medium">Q3.2 Social Value</div>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      "Describe how you will deliver measurable social value outcomes including local employment, apprenticeships, and community engagement..."
                    </p>
                    <div className="flex items-center gap-4 pt-2 border-t border-white/5">
                      <span className="text-gray-600 text-xs">Word limit: 500</span>
                      <span className="text-gray-600 text-xs">Weighting: 15%</span>
                    </div>
                  </div>
                </div>

                {/* Arrow / Timer */}
                <div className="flex flex-col items-center gap-2 py-4">
                  <motion.div
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center shadow-lg shadow-cyan-500/25"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <span className="text-white font-bold text-lg">21s</span>
                  </motion.div>
                  <div className="hidden md:flex flex-col items-center">
                    <motion.div
                      animate={{ y: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <svg className="w-6 h-6 text-cyan-400 rotate-90 md:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </motion.div>
                  </div>
                </div>

                {/* After - Scored Response */}
                <div className="bg-black/40 border border-emerald-500/30 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-emerald-400 text-xs font-medium uppercase tracking-wide">Output</span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 rounded-full">
                      <span className="text-emerald-400 text-xs font-bold">8.5/10</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-gray-300 text-sm leading-relaxed">
                      "Our social value framework delivers <span className="text-cyan-400">12% local employment</span> through partnership with Derby College, creating <span className="text-cyan-400">8 apprenticeships annually</span>. Evidence: Sheffield City Council contract achieved..."
                    </p>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">3 case studies matched</span>
                      <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 text-xs rounded-full">498 words</span>
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs rounded-full">✓ Compliant</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom stats */}
              <div className="relative mt-6 pt-6 border-t border-white/10 grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-cyan-400 font-semibold">Evidence-backed</div>
                  <div className="text-gray-500 text-xs">Every claim verified from BidVault</div>
                </div>
                <div>
                  <div className="text-purple-400 font-semibold">Auto-scored</div>
                  <div className="text-gray-500 text-xs">Against evaluation criteria</div>
                </div>
                <div>
                  <div className="text-emerald-400 font-semibold">Zero hallucination</div>
                  <div className="text-gray-500 text-xs">No fabricated claims or stats</div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Modules */}
        <section className="max-w-[1200px] mx-auto px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="grid md:grid-cols-3 gap-6">
              {modules.map((module, i) => {
                const colors = getColorClasses(module.color);
                const ringColor = module.color === 'purple' ? '#a855f7' : 
                                  module.color === 'amber' ? '#f59e0b' : '#06b6d4';
                return (
                  <motion.div
                    key={module.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    className={`bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-2xl p-6 md:p-8`}
                  >
                    <div className="flex flex-col items-center text-center gap-4">
                      {/* Circular logo with spinning ring */}
                      <div className="relative w-20 h-20">
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{ 
                            border: `2px solid transparent`,
                            borderTopColor: ringColor,
                            borderRightColor: ringColor
                          }}
                          animate={{ rotate: 360 }}
                          transition={{ duration: 3, ease: "linear", repeat: Infinity }}
                        />
                        <div className="absolute inset-2 rounded-full bg-black/30 flex items-center justify-center">
                          <Image 
                            src={module.logo} 
                            alt={module.name} 
                            width={40} 
                            height={40}
                            className="drop-shadow-lg"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <h3 className={`text-xl font-bold ${colors.text} mb-1`}>{module.name}</h3>
                        <p className="text-white font-medium text-sm mb-2">{module.tagline}</p>
                        <p className="text-gray-400 text-sm leading-relaxed">{module.detail}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </section>

        {/* Cost Comparison */}
        <section className="max-w-[1200px] mx-auto px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-8 md:p-10">
              <h2 className="text-center text-xl md:text-2xl font-semibold text-white mb-8">
                What bid writing costs today
              </h2>
              
              <div className="grid md:grid-cols-2 gap-8 mb-8 max-w-2xl mx-auto">
                {/* Bid Writer */}
                <div className="text-center p-6 bg-black/30 rounded-xl border border-white/5">
                  <div className="text-gray-400 text-sm mb-2">Hire a Bid Writer</div>
                  <div className="text-3xl font-bold text-red-400 mb-2">£45-65k</div>
                  <div className="text-gray-500 text-xs">per year + NI, pension, training</div>
                  <div className="text-gray-500 text-xs mt-2">≈ 20-30 bids/year capacity</div>
                </div>
                
                {/* Bid Consultant */}
                <div className="text-center p-6 bg-black/30 rounded-xl border border-white/5">
                  <div className="text-gray-400 text-sm mb-2">Outsource to Consultants</div>
                  <div className="text-3xl font-bold text-amber-400 mb-2">£2-5k</div>
                  <div className="text-gray-500 text-xs">per bid response</div>
                  <div className="text-gray-500 text-xs mt-2">Still takes 2-3 weeks per bid</div>
                </div>
              </div>
              
              <p className="text-center text-gray-400 text-sm max-w-2xl mx-auto">
                There's a better way. <a href="https://demo.bidengine.co" target="_blank" className="text-cyan-400 hover:text-cyan-300">Book a demo</a> and see for yourself.
              </p>
            </div>
          </motion.div>
        </section>

        {/* CTA Section */}
        <section className="max-w-[1200px] mx-auto px-6 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="text-center"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
              See it for yourself
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Watch a real tender processed in minutes. No fluff, no slides — just the platform doing what it does.
            </p>
            <a 
              href="https://demo.bidengine.co" 
              target="_blank"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-lg"
            >
              Book a Demo
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
            <p className="text-gray-500 text-sm mt-4">15 minutes. No commitment. See if it fits.</p>
          </motion.div>
        </section>

        {/* Trust Block */}
        <section className="border-t border-white/10 bg-white/[0.02]">
          <div className="max-w-[1200px] mx-auto px-6 py-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="max-w-3xl mx-auto text-center"
            >
              <p className="text-gray-400 leading-relaxed">
                Built from <span className="text-white">30+ years</span> of real bid writing, sales leadership, and tender evaluation in FM and infrastructure. 
                This platform wasn't designed by prompt engineers — it was built by people who've <span className="text-white">lost bids</span>, <span className="text-white">won bids</span>, and know exactly why.
              </p>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="flex justify-center gap-6 mb-4">
            <a href="/terms" className="text-gray-500 hover:text-white text-sm">Terms</a>
            <a href="/privacy" className="text-gray-500 hover:text-white text-sm">Privacy</a>
          </div>
          <p className="text-gray-600 text-sm">
            © 2026 BidEngine by ProofWorks. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
