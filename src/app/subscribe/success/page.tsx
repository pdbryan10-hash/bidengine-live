'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, Loader2, ArrowRight, PartyPopper } from 'lucide-react';
import { fetchClientByClerkId } from '@/lib/bubble';

export default function SubscribeSuccessPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.push('/sign-in');
      return;
    }

    // Poll for client to be created (webhook may take a moment)
    const checkClient = async () => {
      let attempts = 0;
      const maxAttempts = 10;

      const poll = async () => {
        attempts++;
        const client = await fetchClientByClerkId(user.id);
        
        if (client && client.subscription_status && client.subscription_status !== 'pending') {
          setClientId(client._id);
          setStatus('success');
          return;
        }

        if (attempts < maxAttempts) {
          setTimeout(poll, 2000);
        } else {
          // Even if webhook hasn't fired, redirect them - it'll catch up
          const c = await fetchClientByClerkId(user.id);
          if (c) {
            setClientId(c._id);
            setStatus('success');
          } else {
            setStatus('error');
          }
        }
      };

      poll();
    };

    checkClient();
  }, [isLoaded, user, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Setting up your account...</h1>
          <p className="text-gray-400">This will only take a moment</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Something went wrong</h1>
          <p className="text-gray-400 mb-6">
            We couldn&apos;t complete your account setup. Please contact support.
          </p>
          <a 
            href="mailto:support@bidengine.co"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl">
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
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="text-center max-w-lg">
          {/* Success Icon */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-emerald-500/30 rounded-full blur-2xl" />
            <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-12 h-12 text-white" strokeWidth={3} />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-4">
            <PartyPopper className="w-6 h-6 text-amber-400" />
            <span className="text-amber-400 font-medium">Welcome to BidEngine!</span>
            <PartyPopper className="w-6 h-6 text-amber-400" />
          </div>

          <h1 className="text-3xl font-bold text-white mb-4">
            Your 7-day trial has started
          </h1>
          
          <p className="text-gray-400 mb-8">
            You have full access to all BidEngine features. Let&apos;s help you win your first bid.
          </p>

          {/* Trial Info */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-cyan-400">7</div>
                <div className="text-xs text-gray-500">Days remaining</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">∞</div>
                <div className="text-xs text-gray-500">Tender uploads</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-400">All</div>
                <div className="text-xs text-gray-500">Features unlocked</div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <Link
            href={clientId ? `/v/${clientId}` : '/'}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all"
          >
            Go to Dashboard
            <ArrowRight className="w-5 h-5" />
          </Link>

          <p className="mt-6 text-sm text-gray-500">
            Need help getting started? Check out our{' '}
            <a href="https://docs.bidengine.co" target="_blank" className="text-cyan-400 hover:text-cyan-300">
              documentation
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
