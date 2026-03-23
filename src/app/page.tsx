'use client';

import { motion } from 'framer-motion';
import { SignedIn, SignedOut, UserButton, useUser, useOrganizationList } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchClientByClerkId } from '@/lib/bubble';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { userMemberships, isLoaded: orgsLoaded } = useOrganizationList({ userMemberships: true });
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLoaded && orgsLoaded && user && !checking) {
      setChecking(true);
      const orgId = userMemberships?.data?.[0]?.organization?.id;
      fetchClientByClerkId(user.id, orgId).then(client => {
        if (client) {
          if (!user.passwordEnabled) {
            // Org member with no password yet — intercept to create one
            router.push('/setup');
          } else {
            router.push(`/v/${client._id}`);
          }
        } else {
          // No client record found — send to setup (handles both new users and org members)
          router.push('/setup');
        }
      });
    }
  }, [isLoaded, orgsLoaded, user, userMemberships, router, checking]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col relative overflow-hidden">

      {/* Ambient glow — exact match to app */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -top-[300px] left-1/2 -translate-x-1/2 w-[900px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(6,182,212,0.14) 0%, transparent 65%)' }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-[200px] left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(124,58,237,0.05) 0%, transparent 65%)' }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        <div
          className="absolute -bottom-[300px] right-[-200px] w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.03) 0%, transparent 60%)' }}
        />
      </div>

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
            <text x="48" y="33" fontFamily="system-ui,-apple-system,sans-serif" fontSize="26" fontWeight="800" fill="url(#logoGrad)" letterSpacing="-1">BIDENGINE</text>
          </svg>

          <div className="flex items-center gap-4">
            <a href="https://hello.bidengine.co" target="_blank" className="text-gray-400 hover:text-white transition-colors text-sm">About</a>
            <a href="https://docs.bidengine.co" target="_blank" className="text-gray-400 hover:text-white transition-colors text-sm">Help</a>
            <SignedOut>
              <a href="/sign-in" className="text-gray-400 hover:text-white transition-colors text-sm">Sign In</a>
              <a href="/sign-up" className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity text-sm">
                Get Started
              </a>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-16 relative z-10">
        <div className="w-full max-w-[520px] text-center">

          {/* Welcome tag */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] text-sm text-gray-400 mb-5"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4] animate-pulse" />
            Your bid control centre
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-5xl md:text-6xl font-extrabold text-white leading-[1.08] tracking-[-0.03em] mb-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
          >
            The bid<br />control centre.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-500 mb-2"
          >
            Evidence-backed. Evaluator-ready.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="text-sm text-gray-600 mb-12"
          >
            Built by people who've lost bids, won bids, and know exactly why.
          </motion.p>

          {/* Auth card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="relative mb-10"
          >
            {/* Gradient border glow */}
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-transparent pointer-events-none" />

            <div className="relative bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-2xl p-8">
              <SignedOut>
                <p className="text-lg font-bold text-white mb-1">Sign in to BidEngine</p>
                <p className="text-sm text-gray-500 mb-7">Continue where you left off.</p>

                <div className="text-left mb-4">
                  <label className="block text-xs text-gray-500 mb-2">Email address</label>
                  <a href="/sign-in" className="block w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-500 cursor-text hover:border-white/20 transition-colors">
                    you@company.co.uk
                  </a>
                </div>

                <div className="text-left mb-6">
                  <label className="block text-xs text-gray-500 mb-2">Password</label>
                  <a href="/sign-in" className="block w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-500 cursor-text hover:border-white/20 transition-colors">
                    ••••••••••
                  </a>
                </div>

                <a
                  href="/sign-in"
                  className="block w-full py-3.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-center text-[15px]"
                >
                  Sign In →
                </a>

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-white/[0.08]" />
                  <span className="text-xs text-gray-700">or</span>
                  <div className="flex-1 h-px bg-white/[0.08]" />
                </div>

                <p className="text-sm text-gray-600 text-center">
                  New to BidEngine?{' '}
                  <a href="/sign-up" className="text-cyan-400 font-medium hover:text-cyan-300 transition-colors">Request access</a>
                </p>
              </SignedOut>

              <SignedIn>
                <div className="flex flex-col items-center gap-4 py-4">
                  <UserButton afterSignOutUrl="/" />
                  {error ? (
                    <p className="text-red-400 text-sm">{error}</p>
                  ) : (
                    <p className="text-gray-400 text-sm">Redirecting to your dashboard...</p>
                  )}
                </div>
              </SignedIn>
            </div>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="flex items-center justify-center flex-wrap gap-3"
          >
            {[
              { dot: 'bg-cyan-400 shadow-[0_0_6px_#06b6d4]',    label: 'Evidence-backed only' },
              { dot: 'bg-emerald-400 shadow-[0_0_6px_#10b981]', label: 'Zero hallucinations' },
              { dot: 'bg-purple-400 shadow-[0_0_6px_#a855f7]',  label: '8.5+ average score' },
            ].map(({ dot, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-full text-xs text-gray-500"
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                {label}
              </div>
            ))}
          </motion.div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-5 relative z-10">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="flex justify-center gap-6 mb-2">
            <a href="/terms" className="text-gray-600 hover:text-white text-sm transition-colors">Terms</a>
            <a href="/privacy" className="text-gray-600 hover:text-white text-sm transition-colors">Privacy</a>
          </div>
          <p className="text-gray-700 text-sm">© 2026 BidEngine by ProofWorks. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
