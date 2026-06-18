/** App-wide URLs and copy — prefer `NEXT_PUBLIC_APP_URL` in deployment. */
export const APP_CONFIG = {
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  name: 'Buddget',
  tagline: 'Your money, finally makes sense.',
  supportEmail: 'hello@buddget.app',
  noReplyEmail: 'noreply@buddget.app',
  domain: 'buddget.app',
} as const
