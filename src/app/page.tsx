'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchClientByClerkId } from '@/lib/bubble';

const modules = [
  { name: 'BidVault', description: 'Evidence Library', logo: '/bidvault-logo.svg', color: '#a855f7' },
  { name: 'BidWrite', description: 'Response Builder', logo: '/bidwrite-logo.svg', color: '#3b82f6' },
  { name: 'BidGate', description: 'Go/No-Go Analysis', logo: '/bidgate-logo.svg', color: '#f59e0b' },
  { name: 'BidCheck', description: 'Pre-Submission Gate', logo: '/bidcheck-logo.svg', color: '#00e07a' },
];

export default function HomePage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (isLoaded && user && !checking) {
      setChecking(true);
      fetchClientByClerkId(user.id).then(client => {
        if (client) {
          router.push(`/v/${client._id}`);
        } else {
          router.push('/sign-in');
        }
      });
    }
  }, [isLoaded, user, router, checking]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-6">

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12 text-center"
      >
        <svg width="260" height="48" viewBox="0 0 280 50" style={{ filter: 'drop-shadow(0 0 15px rgba(0,212,255,0.4))' }}>
          <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00d4ff" />
              <stop offset="50%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
          </defs>
          <text x="0" y="38" fontFamily="system-ui, -apple-system, sans-serif" fontSize="36" fontWeight="800" letterSpacing="-1" fill="url(#logoGrad)">BIDENGINE</text>
        </svg>
        <p className="text-gray-600 text-xs font-mono tracking-widest uppercase mt-1">The bid platform that thinks like the panel</p>
      </motion.div>

      {/* Module grid */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-4 gap-4 mb-12 w-full max-w-2xl"
      >
        {modules.map((m, i) => (
          <motion.div
            key={m.name}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.07 }}
            className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-white/[0.08] bg-white/[0.03]"
          >
            <div className="relative w-14 h-14">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: '2px solid transparent', borderTopColor: m.color, borderRightColor: m.color }}
                animate={{ rotate: 360 }}
                transition={{ duration: 3 + i * 0.5, ease: 'linear', repeat: Infinity }}
              />
              <div className="absolute inset-1.5 rounded-full bg-black/40 flex items-center justify-center">
                <Image src={m.logo} alt={m.name} width={28} height={28} className="drop-shadow-lg" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-white text-xs font-bold">{m.name}</p>
              <p className="text-gray-600 text-[10px] font-mono mt-0.5">{m.description}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Auth */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col items-center gap-4"
      >
        <SignedOut>
          <a
            href="/sign-in"
            className="px-10 py-3 rounded-xl font-bold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #7c3aed, #f472b6)' }}
          >
            Sign In
          </a>
          <a href="/sign-up" className="text-gray-600 text-xs hover:text-gray-400 transition-colors">
            No account? <span className="text-cyan-500">Request access</span>
          </a>
        </SignedOut>

        <SignedIn>
          <div className="flex flex-col items-center gap-3">
            <p className="text-gray-400 text-sm font-mono">Redirecting to your dashboard...</p>
            <UserButton afterSignOutUrl="/" />
          </div>
        </SignedIn>
      </motion.div>

      {/* Footer */}
      <div className="absolute bottom-6 flex gap-6">
        <a href="/terms" className="text-gray-700 text-xs hover:text-gray-500 transition-colors">Terms</a>
        <a href="/privacy" className="text-gray-700 text-xs hover:text-gray-500 transition-colors">Privacy</a>
        <span className="text-gray-800 text-xs">© 2026 ProofWorks</span>
      </div>

    </div>
  );
}
