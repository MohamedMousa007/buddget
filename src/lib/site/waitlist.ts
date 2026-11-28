/** Answer keys the waitlist form offers. The database CHECKs in 0368 list the same values. */
export const WAITLIST_CHOICES = {
  trackingNow: ['nothing', 'head', 'notes', 'spreadsheet', 'bank_app', 'another_app'],
  wantMost: ['daily_number', 'bank_texts', 'installments', 'goals', 'income', 'buddgy'],
  heardFrom: ['friend', 'social', 'search', 'store', 'other'],
} as const satisfies Record<string, readonly [string, ...string[]]>

/** Country picker, ISO codes; ZZ (the ISO "unknown" code) stands for anywhere else. */
export const WAITLIST_COUNTRIES = ['EG', 'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'JO', 'MA', 'US', 'GB', 'ZZ'] as const

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

/** A waitlist member's share code (0368) and an in-app invite code (referral_codes). */
export const WAITLIST_SHARE_CODE = /^W[2-9A-HJKMNP-Z]{7}$/
export const APP_INVITE_CODE = /^[A-Z0-9]{2,8}-[A-Z0-9]{3,5}$/

/** The invite landing a code opens: the guest pass from the inviter, then the waitlist form. */
export function waitlistInvitePath(locale: 'en' | 'ar', code: string): string {
  return `/${locale}/waitlist/invite?ref=${encodeURIComponent(code)}`
}

/** Share link a waitlist member passes on. */
export function waitlistShareUrl(origin: string, locale: 'en' | 'ar', code: string): string {
  return `${origin}${waitlistInvitePath(locale, code)}`
}

/** First word of a name, at most 24 characters: all a guest pass signature shows. */
export function firstWord(name: string | null | undefined): string | null {
  const w = (name ?? '').trim().split(/\s+/)[0] ?? ''
  return w ? Array.from(w).slice(0, 24).join('') : null
}
