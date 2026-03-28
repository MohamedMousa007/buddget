import type { NextConfig } from 'next'
import path from 'path'

// next-pwa is CommonJS — require keeps Next’s config resolution stable.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  /** false = new SW can stay in `waiting` until the user refreshes (see PwaUpdateNotifier + usePwaUpdateAvailable). */
  skipWaiting: false,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
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
      ],
    },
  ],
}

export default withPWA(nextConfig)
