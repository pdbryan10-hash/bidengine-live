'use client';

import Link from 'next/link';

export default function TermsOfService() {
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
        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-8">Last updated: January 2025</p>

        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">1. Introduction</h2>
            <p>These Terms of Service govern your use of BidEngine, a trading name of ProofWorks (Company No. 193465832), located at Archer Drive, Derby, DE3 0AG, United Kingdom.</p>
            <p>By accessing or using BidEngine, you agree to be bound by these Terms. If you do not agree, please do not use the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">2. Description of Service</h2>
            <p>BidEngine is an AI-powered bid and tender response platform that provides:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Evidence library management (BidVault)</li>
              <li>Go/no-go tender analysis (BidGate)</li>
              <li>AI-assisted response generation with built-in quality scoring (BidWrite)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">3. Account Registration</h2>
            <p>To use BidEngine, you must:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Be at least 18 years old</li>
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">4. Subscription and Payment</h2>
            <p><strong>Billing:</strong> Subscriptions are billed monthly via Stripe. Your subscription will automatically renew unless cancelled.</p>
            <p><strong>Cancellation:</strong> You may cancel your subscription at any time. Access continues until the end of your current billing period.</p>
            <p><strong>Refunds:</strong> Refunds are provided at our discretion. Contact support@bidengine.co for refund requests.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">5. Acceptable Use</h2>
            <p>You agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Upload malicious code, viruses, or harmful content</li>
              <li>Attempt to gain unauthorised access to our systems</li>
              <li>Reverse engineer or copy the Service</li>
              <li>Use the Service to generate false or fraudulent bid responses</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">6. Your Content</h2>
            <p><strong>Ownership:</strong> You retain ownership of all content you upload to BidEngine.</p>
            <p><strong>Licence:</strong> You grant us a limited licence to process your content solely to provide the Service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">7. AI-Generated Content</h2>
            <p>BidEngine uses artificial intelligence to assist in generating bid responses. You acknowledge that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>AI-generated content should be reviewed before submission</li>
              <li>You are responsible for the accuracy of any responses you submit</li>
              <li>We do not guarantee that AI-generated content will win bids</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, the Service is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">9. Governing Law</h2>
            <p>These Terms are governed by the laws of England and Wales.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">10. Contact Us</h2>
            <p>ProofWorks (trading as BidEngine)<br />
            Archer Drive, Derby, DE3 0AG<br />
            Email: support@bidengine.co</p>
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
