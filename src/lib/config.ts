/** App-wide URLs and copy — prefer `NEXT_PUBLIC_APP_URL` in deployment. */
export const APP_CONFIG = {
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  name: 'Buddget',
  tagline: 'Your money, finally makes sense.',
  supportEmail: 'hello@buddget.online',
  noReplyEmail: 'noreply@buddget.online',
  domain: 'buddget.online',
} as const

const base = APP_CONFIG.url.replace(/\/$/, '')

export const AUTH_REDIRECTS = {
  afterLogin: '/',
  afterSignup: '/onboarding',
  afterLogout: '/',
  /** Supabase `resetPasswordForEmail` — must match an allowed Redirect URL in Supabase. */
  passwordReset: `${base}/auth/callback?next=/reset-password/confirm`,
  authCallback: `${base}/auth/callback`,
} as const
