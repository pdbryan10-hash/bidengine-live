/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pdf-parse', 'mammoth'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.bidengine.co https://*.clerk.accounts.dev https://js.stripe.com https://vercel.live",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: blob:",
              "connect-src 'self' https://clerk.bidengine.co https://*.clerk.accounts.dev https://api.anthropic.com https://app.bidengine.co https://app.bidengine.co/version-test/api/1.1/wf https://app.bidengine.co/version-test/api/1.1/obj https://*.bubble.io https://api.openai.com",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://vercel.live",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig
