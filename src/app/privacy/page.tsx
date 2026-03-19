'use client';

import Link from 'next/link';

export default function PrivacyPolicy() {
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
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: January 2025</p>

        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">1. Introduction</h2>
            <p>ProofWorks (trading as BidEngine), Company No. 193465832, is committed to protecting your privacy in compliance with the UK GDPR and Data Protection Act 2018.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">2. Data Controller</h2>
            <p><strong>Terri Bryan</strong><br />
            ProofWorks (trading as BidEngine)<br />
            Archer Drive, Derby, DE3 0AG<br />
            Email: privacy@bidengine.co</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">3. Data We Collect</h2>
            <p><strong>Account Information:</strong> Name, email, company details, payment information</p>
            <p><strong>Content You Upload:</strong> Bid documents, evidence records, generated responses</p>
            <p><strong>Usage Data:</strong> Login times, IP addresses, features used</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">4. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Providing the Service (contract performance)</li>
              <li>Processing payments (contract performance)</li>
              <li>Sending service updates (legitimate interest)</li>
              <li>Improving our Service (legitimate interest)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">5. Third-Party Processors</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Bubble (AWS)</strong> - Database hosting (USA)</li>
              <li><strong>Clerk</strong> - Authentication (USA)</li>
              <li><strong>OpenAI</strong> - AI processing (USA)</li>
              <li><strong>n8n</strong> - Workflow automation (Germany/EU)</li>
              <li><strong>Stripe</strong> - Payment processing (USA)</li>
              <li><strong>Vercel</strong> - Website hosting (USA)</li>
            </ul>
            <p className="mt-4">Where data is transferred outside the UK/EEA, appropriate safeguards are in place.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">6. Data Retention</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Account data: Duration of account plus 2 years</li>
              <li>Uploaded content: Duration of account</li>
              <li>Payment records: 7 years (legal requirement)</li>
              <li>Usage logs: 12 months</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">7. Your Rights (GDPR)</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> Request a copy of your data</li>
              <li><strong>Rectification:</strong> Correct inaccurate data</li>
              <li><strong>Erasure:</strong> Request deletion ("right to be forgotten")</li>
              <li><strong>Restrict Processing:</strong> Limit how we use your data</li>
              <li><strong>Data Portability:</strong> Receive your data in portable format</li>
              <li><strong>Object:</strong> Object to processing based on legitimate interests</li>
            </ul>
            <p className="mt-4">Contact privacy@bidengine.co to exercise these rights. We respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">8. Data Security</h2>
            <p>We implement encryption in transit (TLS/SSL), encrypted database storage, secure authentication, and access controls.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">9. Complaints</h2>
            <p>You may lodge a complaint with the Information Commissioner's Office (ICO):<br />
            <a href="https://ico.org.uk" target="_blank" className="text-cyan-400 hover:underline">ico.org.uk</a></p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-4">10. Contact</h2>
            <p><strong>Terri Bryan</strong> (Data Controller)<br />
            ProofWorks, Archer Drive, Derby, DE3 0AG<br />
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
