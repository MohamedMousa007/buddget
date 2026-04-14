import type { NextConfig } from 'next'
import path from 'path'

// next-pwa is CommonJS — require keeps Next’s config resolution stable.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  /** false = new SW can stay in `waiting` until the user refreshes (see UpdateToast + usePwaUpdate). */
  skipWaiting: false,
  /** Local dev disables SW by default; set `NEXT_PUBLIC_PWA_DEV=true` to test install prompts locally. */
  disable: process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_PWA_DEV !== 'true',
  buildExcludes: [/middleware-manifest\.json$/],
  fallbacks: {
    document: '/offline',
  },
})

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Prefer this app’s root when another lockfile exists higher on disk (Vercel/local). */
  outputFileTracingRoot: path.join(process.cwd()),
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' https://fonts.gstatic.com",
            "worker-src 'self' blob:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://open.er-api.com https://api.frankfurter.dev https://api.frankfurter.app https://metals.live https://api.metals.live https://gold-api.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; '),
        },
      ],
    },
  ],
}

export default withPWA(nextConfig)
