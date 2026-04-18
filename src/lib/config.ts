/** App-wide URLs and copy — prefer `NEXT_PUBLIC_APP_URL` in deployment. */
export const APP_CONFIG = {
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  name: 'Buddget',
  tagline: 'Your money, finally makes sense.',
  supportEmail: 'hello@buddget.app',
  noReplyEmail: 'noreply@buddget.app',
  domain: 'buddget.app',
} as const

const base = APP_CONFIG.url.replace(/\/$/, '')

export const AUTH_REDIRECTS = {
  afterLogin: '/',
  afterSignup: '/onboarding',
  afterLogout: '/',
  /**
   * Supabase `resetPasswordForEmail` fallback when `window` is unavailable (SSR).
   * Client code should prefer `window.location.origin` so production links never point at localhost.
   */
  passwordReset: `${base}/auth/callback?next=/reset-password/confirm`,
  authCallback: `${base}/auth/callback`,
} as const
