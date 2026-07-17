import { format } from 'date-fns'

/**
 * Today's calendar date as `yyyy-MM-dd` in the RUNTIME-LOCAL timezone.
 *
 * Replaces `new Date().toISOString().slice(0, 10)`, which is UTC: in Cairo (UTC+2/+3) that
 * lands on the WRONG day between local midnight and ~2–3am, so an expense logged just after
 * midnight was filed to "yesterday", "Today" grouped it wrong, and a default date on a new
 * entry was off by a day.
 *
 * On the client this is the user's local day (the fix). On a UTC server (Vercel) it equals
 * the old value, so replacing server-side calls is a safe no-op — the format is identical
 * `yyyy-MM-dd` everywhere.
 */
export function localTodayISO(ref: Date = new Date()): string {
  return format(ref, 'yyyy-MM-dd')
}
