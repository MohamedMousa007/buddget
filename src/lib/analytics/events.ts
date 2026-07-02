/**
 * Lightweight analytics event constants + a `track()` stub.
 *
 * Zero infrastructure today — `track()` just `console.debug`s in development
 * so the event stream is visible during manual QA. When a real analytics
 * pipeline is wired up (e.g. Supabase `/api/admin/analytics`, PostHog,
 * Segment), swap the body without touching call sites.
 */

export const AUTH_EVENTS = {
  emailSubmitted: 'auth.email_submitted',
  emailStateResolved: 'auth.email_state_resolved',
  passwordSubmitted: 'auth.password_submitted',
  backToEmail: 'auth.back_to_email',
  morphFallback: 'auth.morph_fallback',
  droppedAt: 'auth.dropped_at',
} as const

type EventName = (typeof AUTH_EVENTS)[keyof typeof AUTH_EVENTS] | (string & {})

type EventProps = Record<string, string | number | boolean | null | undefined>

/**
 * Fire an analytics event. Safe to call from both client + server; becomes a
 * no-op outside the browser.
 */
export function track(name: EventName, props?: EventProps): void {
  if (typeof window === 'undefined') return
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[analytics]', name, props ?? {})
  }
  // Hook: future integration can POST to /api/analytics here without touching
  // call sites. Keep the signature stable.
}
