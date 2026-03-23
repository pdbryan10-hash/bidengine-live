'use client';

import { useState, useEffect } from 'react';
import { useUser, useOrganizationList } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Lock, CheckCircle } from 'lucide-react';
import { fetchClientByClerkId } from '@/lib/bubble';

export default function SetupPage() {
  const { user, isLoaded } = useUser();
  const { userMemberships, isLoaded: orgsLoaded } = useOrganizationList({ userMemberships: true });
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('');

  // Org member state
  const [orgClient, setOrgClient] = useState<{ _id: string } | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [orgCheckDone, setOrgCheckDone] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Redirect to sign-up if not logged in
  useEffect(() => {
    if (isLoaded && !user) {
      router.push('/sign-up');
    }
  }, [isLoaded, user, router]);

  // If user belongs to an org that already has a workspace, intercept before entry.
  // Retries up to 4x (6s total) because Clerk may not sync org memberships instantly
  // for brand-new users who just accepted an invite.
  useEffect(() => {
    if (!isLoaded || !orgsLoaded || !user) return;

    const orgId = userMemberships?.data?.[0]?.organization?.id
      ?? (user as any).organizationMemberships?.[0]?.organization?.id;

    if (!orgId) {
      if (retryCount < 4) {
        // Membership not loaded yet — wait and retry
        const t = setTimeout(() => setRetryCount(c => c + 1), 1500);
        return () => clearTimeout(t);
      }
      // Gave up — no org, show company name form
      setOrgCheckDone(true);
      return;
    }

    fetchClientByClerkId(user.id, orgId).then(client => {
      if (client) {
        if (user.passwordEnabled) {
          // Returning member — already has a password, go straight to workspace
          router.replace(`/v/${client._id}`);
          return;
        }
        setOrgClient(client);
        setNeedsPassword(true);
      }
      setOrgCheckDone(true);
    });
  }, [isLoaded, orgsLoaded, user, userMemberships, retryCount]);

  const handleSetPassword = async () => {
    if (!user || !orgClient) return;
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    try {
      await user.updatePassword({ newPassword: password, signOutOfOtherSessions: false });
      router.replace(`/v/${orgClient._id}`);
    } catch (e: any) {
      const code = e?.errors?.[0]?.code ?? '';
      if (code.includes('reverif') || code === 'session_reverification_required') {
        // Already has a valid password (older session) — let them in
        router.replace(`/v/${orgClient._id}`);
      } else {
        setError(e?.errors?.[0]?.message || 'Failed to set password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGetStarted = async () => {
    if (!user) { router.push('/sign-up'); return; }
    if (!companyName.trim()) { setError('Please enter your company name'); return; }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/client/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerkUserId: user.id,
          email: user.primaryEmailAddress?.emailAddress,
          companyName: companyName.trim(),
          userName: [user.firstName, user.lastName].filter(Boolean).join(' '),
        }),
      });
      const data = await response.json();
      if (data.clientId) {
        router.push(`/v/${data.clientId}`);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const firstName = user?.firstName || 'there';

  if (!isLoaded || !orgsLoaded || !orgCheckDone) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      <header className="border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl">
        <div className="max-w-[800px] mx-auto px-6 py-4">
          <Link href="/">
            <svg width="160" height="40" viewBox="0 0 200 50" className="drop-shadow-[0_0_15px_rgba(0,212,255,0.5)]">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00d4ff"/>
                  <stop offset="50%" stopColor="#a855f7"/>
                  <stop offset="100%" stopColor="#ec4899"/>
                </linearGradient>
              </defs>
              <text x="0" y="33" fontFamily="system-ui, -apple-system, sans-serif" fontSize="26" fontWeight="800" fill="url(#logoGrad)" letterSpacing="-1">BIDENGINE</text>
            </svg>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* Org member — always create/set password before entry */}
          {orgClient && needsPassword && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">One last step</h1>
                <p className="text-gray-400">Create a password to secure your account</p>
              </div>
              <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                    <Lock size={20} className="text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold">Set your password</h2>
                    <p className="text-gray-500 text-sm">Min. 8 characters</p>
                  </div>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all mb-3"
                  autoFocus
                />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all mb-4"
                  onKeyDown={e => { if (e.key === 'Enter') handleSetPassword(); }}
                />
                <button
                  onClick={handleSetPassword}
                  disabled={loading || !password || !confirmPassword}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {loading ? 'Setting up...' : 'Set Password & Enter →'}
                </button>
                {error && <p className="text-red-400 text-center text-sm mt-4">{error}</p>}
              </div>
            </>
          )}

          {/* Org member — password set via Clerk sign-up, welcome them in */}
          {orgClient && !needsPassword && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Welcome, {firstName}!</h1>
                <p className="text-gray-400">You've been added to a BidEngine workspace</p>
              </div>
              <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                    <CheckCircle size={20} className="text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold">Account ready</h2>
                    <p className="text-gray-500 text-sm">{user?.primaryEmailAddress?.emailAddress}</p>
                  </div>
                </div>
                <button
                  onClick={() => router.replace(`/v/${orgClient._id}`)}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all text-lg"
                >
                  Enter Workspace →
                </button>
              </div>
            </>
          )}

          {/* New account owner — enter company name */}
          {!orgClient && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Welcome, {firstName}! 👋</h1>
                <p className="text-gray-400">One quick thing before we get started</p>
              </div>
              <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                    <Building2 size={20} className="text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-white font-semibold">Company Name</h2>
                    <p className="text-gray-500 text-sm">This will appear on your dashboard and exports</p>
                  </div>
                </div>
                <input
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="Enter your company name"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all mb-4"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter' && companyName.trim()) handleGetStarted(); }}
                />
                <button
                  onClick={handleGetStarted}
                  disabled={loading || !companyName.trim()}
                  className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                >
                  {loading ? 'Setting up...' : 'Get Started →'}
                </button>
                {error && <p className="text-red-400 text-center text-sm mt-4">{error}</p>}
              </div>
            </>
          )}

        </div>
      </main>

      <footer className="border-t border-white/10 py-4">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <div className="flex justify-center gap-6 text-xs text-gray-500">
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <a href="https://docs.bidengine.co" target="_blank" className="hover:text-white">Help</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
