import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export default function SignInPage() {
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
          <div className="flex items-center gap-4">
            <a href="https://docs.bidengine.co" target="_blank" className="text-gray-400 hover:text-white transition-colors text-sm">
              Help
            </a>
            <Link href="/sign-up" className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity text-sm">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Tagline */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-gray-400">Sign in to continue to BidEngine</p>
          </div>

          {/* Clerk SignIn with dark theme */}
          <SignIn 
            afterSignInUrl="/"
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
                alert: 'bg-red-500/10 border-red-500/20 text-red-400',
                alertText: 'text-red-400',
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

          {/* Help text */}
          <div className="mt-8 text-center">
            <p className="text-gray-500 text-sm">
              Need help? <a href="https://docs.bidengine.co" target="_blank" className="text-cyan-400 hover:text-cyan-300">Visit our docs</a> or <a href="mailto:support@bidengine.co" className="text-cyan-400 hover:text-cyan-300">contact support</a>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-4">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
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
