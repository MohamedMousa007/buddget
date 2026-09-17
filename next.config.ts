import type { NextConfig } from 'next'
import path from 'path'

/**
 * Capacitor static-export mode: when `CAPACITOR=true` is set in the build env
 * we emit a static HTML bundle to `out/` for the iOS/Android shells. Server
 * features (route handlers, server actions, headers, middleware) are inert in
 * that build — the native app talks to the deployed API origin via
 * `NEXT_PUBLIC_API_BASE_URL` (see `src/lib/apiBase.ts`).
 */
const IS_CAPACITOR = process.env.CAPACITOR === 'true'

// next-pwa is CommonJS — require keeps Next’s config resolution stable.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  /** false = new SW can stay in `waiting` until the user refreshes (see UpdateToast + usePwaUpdate). */
  skipWaiting: false,
  /** Local dev disables SW by default; set `NEXT_PUBLIC_PWA_DEV=true` to test install prompts locally.
   *  Capacitor static export disables next-pwa: the WebView already caches assets natively. */
  disable:
    IS_CAPACITOR ||
    (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_PWA_DEV !== 'true'),
  buildExcludes: [/middleware-manifest\.json$/],
  fallbacks: {
    document: '/offline',
  },
})

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  /** Prefer this app’s root when another lockfile exists higher on disk (Vercel/local). */
  outputFileTracingRoot: path.join(process.cwd()),
  ...(IS_CAPACITOR
    ? {
        output: 'export' as const,
        trailingSlash: true,
        images: { unoptimized: true },
        skipTrailingSlashRedirect: true,
      }
    : {}),
  headers: async () => [
    {
      // Apple AutoFill fetches this extension-less file and (with nosniff)
      // requires Content-Type: application/json. Vercel would otherwise serve
      // it as octet-stream and the association would fail to validate.
      source: '/.well-known/apple-app-site-association',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
    },
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        {
          key: 'Permissions-Policy',
          value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
        },
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
      ],
    },
  ],
}

export default withPWA(nextConfig)
