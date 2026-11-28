/** Answer keys the waitlist form offers. The database CHECKs in 0368 list the same values. */
export const WAITLIST_CHOICES = {
  trackingNow: ['nothing', 'head', 'notes', 'spreadsheet', 'bank_app', 'another_app'],
  wantMost: ['daily_number', 'bank_texts', 'installments', 'goals', 'income', 'buddgy'],
  heardFrom: ['friend', 'social', 'search', 'store', 'other'],
} as const satisfies Record<string, readonly [string, ...string[]]>

/** Country picker, ISO codes; ZZ (the ISO "unknown" code) stands for anywhere else. */
export const WAITLIST_COUNTRIES = ['EG', 'SA', 'AE', 'KW', 'QA', 'BH', 'OM', 'JO', 'MA', 'US', 'GB', 'ZZ'] as const

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

/** Share link a waitlist member passes on. */
export function waitlistShareUrl(origin: string, locale: 'en' | 'ar', code: string): string {
  return `${origin}/${locale}/waitlist?ref=${encodeURIComponent(code)}`
}
