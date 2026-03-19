'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { SignUp, useUser } from '@clerk/nextjs';
import { Building2, Check, ArrowRight, Zap, Shield, Clock } from 'lucide-react';

interface InviteData {
  valid: boolean;
  company_name?: string;
  email?: string;
  already_accepted?: boolean;
  client_id?: string;
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const token = params.token as string;
  
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      validateInvite();
    }
  }, [token]);

  // If user is already logged in and invite is valid, auto-accept
  useEffect(() => {
    if (userLoaded && user && inviteData?.valid && !inviteData?.already_accepted) {
      acceptInvite();
    }
  }, [userLoaded, user, inviteData]);

  const validateInvite = async () => {
    try {
      const response = await fetch(`/api/invite/${token}`);
      const data = await response.json();
      setInviteData(data);
    } catch (err) {
      setInviteData({ valid: false });
    } finally {
      setLoading(false);
    }
  };

  const acceptInvite = async () => {
    if (!user) return;
    
    setAccepting(true);
    setError('');

    try {
      const response = await fetch(`/api/invite/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerk_user_id: user.id,
          email: user.primaryEmailAddress?.emailAddress,
        }),
      });

      const data = await response.json();

      if (response.ok && data.client_id) {
        // Redirect to their dashboard
        router.push(`/v/${data.client_id}`);
      } else {
        setError(data.error || 'Failed to accept invite');
      }
    } catch (err) {
      setError('Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Invalid or expired invite
  if (!inviteData?.valid) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">❌</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Invite</h1>
          <p className="text-gray-400 mb-6">
            This invite link is invalid or has expired. Please contact your administrator for a new invite.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
          >
            Go to homepage
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  // Already accepted
  if (inviteData.already_accepted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Already Set Up!</h1>
          <p className="text-gray-400 mb-6">
            This account has already been activated. Sign in to access your dashboard.
          </p>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity"
          >
            Sign In
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  // Valid invite - show signup/accept flow
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl">
        <div className="max-w-[800px] mx-auto px-6 py-4">
          <svg width="160" height="40" viewBox="0 0 200 50" className="drop-shadow-[0_0_15px_rgba(0,212,255,0.5)]">
            <defs>
              <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00d4ff"/>
                <stop offset="50%" stopColor="#a855f7"/>
                <stop offset="100%" stopColor="#ec4899"/>
              </linearGradient>
            </defs>
            <text x="0" y="33" fontFamily="system-ui" fontSize="26" fontWeight="800" fill="url(#logoGrad)" letterSpacing="-1">BIDENGINE</text>
          </svg>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Welcome Card */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full mb-4">
              <Check size={16} className="text-emerald-400" />
              <span className="text-emerald-400 text-sm font-medium">You're Invited!</span>
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">
              Welcome to BidEngine
            </h1>
            
            <div className="flex items-center justify-center gap-2 mb-4">
              <Building2 size={18} className="text-cyan-400" />
              <span className="text-cyan-400 font-medium">{inviteData.company_name}</span>
            </div>
            
            <p className="text-gray-400">
              Create your account to access your company's bid management dashboard.
            </p>
          </div>

          {/* If user is logged in, show accept button */}
          {userLoaded && user ? (
            <div className="bg-[#111] border border-white/10 rounded-2xl p-6 mb-6">
              <p className="text-gray-400 text-center mb-4">
                Signed in as <span className="text-white">{user.primaryEmailAddress?.emailAddress}</span>
              </p>
              
              <button
                onClick={acceptInvite}
                disabled={accepting}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
              >
                {accepting ? 'Setting up...' : 'Access Dashboard →'}
              </button>

              {error && (
                <p className="text-red-400 text-center text-sm mt-4">{error}</p>
              )}
            </div>
          ) : (
            /* Show Clerk signup */
            <SignUp
              forceRedirectUrl={`/invite/${token}`}
              appearance={{
                elements: {
                  rootBox: 'mx-auto w-full',
                  card: 'bg-[#111] border border-white/10 shadow-2xl',
                  headerTitle: 'text-white',
                  headerSubtitle: 'text-gray-400',
                  socialButtonsBlockButton: 'bg-white/5 border-white/10 text-white hover:bg-white/10',
                  socialButtonsBlockButtonText: 'text-white font-medium',
                  dividerLine: 'bg-white/10',
                  dividerText: 'text-gray-500',
                  formFieldLabel: 'text-gray-300',
                  formFieldInput: 'bg-white/5 border-white/10 text-white placeholder-gray-500',
                  formButtonPrimary: 'bg-gradient-to-r from-cyan-500 to-purple-500 hover:opacity-90',
                  footerActionLink: 'text-cyan-400 hover:text-cyan-300',
                  identityPreviewText: 'text-white',
                  identityPreviewEditButton: 'text-cyan-400',
                  formFieldInputShowPasswordButton: 'text-gray-400 hover:text-white',
                  otpCodeFieldInput: 'bg-white/5 border-white/10 text-white',
                  formResendCodeLink: 'text-cyan-400',
                },
                variables: {
                  colorPrimary: '#06b6d4',
                  colorBackground: '#111',
                  colorInputBackground: 'rgba(255,255,255,0.05)',
                  colorInputText: '#fff',
                  colorText: '#fff',
                  colorTextSecondary: '#9ca3af',
                  borderRadius: '0.75rem',
                }
              }}
            />
          )}

          {/* What you get */}
          <div className="mt-8 space-y-3">
            {[
              { icon: Zap, text: 'AI-powered bid responses in minutes' },
              { icon: Shield, text: 'Your evidence library, ready to go' },
              { icon: Clock, text: 'Go/no-go decisions in 60 seconds' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-gray-400">
                <item.icon size={16} className="text-cyan-400" />
                <span className="text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-white/10 py-4">
        <div className="max-w-[800px] mx-auto px-6 text-center">
          <div className="flex justify-center gap-6 text-xs text-gray-500">
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
