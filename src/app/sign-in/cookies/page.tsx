'use client';

import Link from 'next/link';

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <header className="border-b border-white/10 bg-[#0a0a12]/90 backdrop-blur-xl">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/">
            <svg width="180" height="45" viewBox="0 0 320 80">
              <defs>
                <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#00d4ff"/>
                  <stop offset="100%" stopColor="#7c3aed"/>
                </linearGradient>
              </defs>
              <text x="0" y="52" fontFamily="system-ui" fontSize="42" fontWeight="700" fill="url(#logoGrad)">BIDENGINE</text>
            </svg>
          </Link>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-2">Cookie Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: January 2025</p>

        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">1. What Are Cookies?</h2>
            <p>Cookies are small text files stored on your device when you visit a website. They help websites remember your preferences and improve your experience.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">2. How We Use Cookies</h2>
            <p>BidEngine uses minimal cookies, primarily for authentication purposes. We do not use cookies for advertising or tracking.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">3. Cookies We Use</h2>
            <table className="w-full mt-4 text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 text-white">Cookie</th>
                  <th className="text-left py-2 text-white">Provider</th>
                  <th className="text-left py-2 text-white">Purpose</th>
                  <th className="text-left py-2 text-white">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/10">
                  <td className="py-2">__client</td>
                  <td className="py-2">Clerk</td>
                  <td className="py-2">Authentication session</td>
                  <td className="py-2">Session</td>
                </tr>
                <tr className="border-b border-white/10">
                  <td className="py-2">__client_uat</td>
                  <td className="py-2">Clerk</td>
                  <td className="py-2">Authentication token</td>
                  <td className="py-2">1 year</td>
                </tr>
                <tr className="border-b border-white/10">
                  <td className="py-2">__session</td>
                  <td className="py-2">Clerk</td>
                  <td className="py-2">Session management</td>
                  <td className="py-2">Session</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">4. Cookie Categories</h2>
            <p><strong>Essential Cookies (Required):</strong> These cookies are necessary for the website to function and cannot be disabled.</p>
            <p><strong>Analytics Cookies:</strong> Not used.</p>
            <p><strong>Marketing Cookies:</strong> Not used.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">5. Managing Cookies</h2>
            <p>You can control cookies through your browser settings:</p>
            <ul className="list-disc pl-6 space-y-2 mt-4">
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" className="text-cyan-400 hover:underline">Google Chrome</a></li>
              <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" className="text-cyan-400 hover:underline">Mozilla Firefox</a></li>
              <li><a href="https://support.apple.com/en-gb/guide/safari/sfri11471/mac" target="_blank" className="text-cyan-400 hover:underline">Safari</a></li>
              <li><a href="https://support.microsoft.com/en-us/windows/delete-and-manage-cookies-168dab11-0753-043d-7c16-ede5947fc64d" target="_blank" className="text-cyan-400 hover:underline">Microsoft Edge</a></li>
            </ul>
            <p className="mt-4"><strong>Note:</strong> Disabling essential cookies may prevent you from using BidEngine.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">6. Contact</h2>
            <p>ProofWorks (trading as BidEngine)<br />
            Archer Drive, Derby, DE3 0AG<br />
            Email: privacy@bidengine.co</p>
          </section>
        </div>
      </main>

      <footer className="border-t border-white/10 py-6 mt-12">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="flex justify-center gap-6 mb-4">
            <Link href="/terms" className="text-gray-500 hover:text-white text-sm">Terms</Link>
            <Link href="/privacy" className="text-gray-500 hover:text-white text-sm">Privacy</Link>
            <Link href="/cookies" className="text-gray-500 hover:text-white text-sm">Cookies</Link>
          </div>
          <p className="text-gray-600 text-sm">© 2025 BidEngine by ProofWorks. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
