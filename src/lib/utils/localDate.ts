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

/** Calendar day (`yyyy-MM-dd`) of a date-only string or ISO instant, in the runtime-local timezone. */
export function localDayKey(isoOrDate: string): string {
  return isoOrDate.length === 10 ? isoOrDate : format(new Date(isoOrDate), 'yyyy-MM-dd')
}

const DAY_PREFIX = /^\d{4}-\d{2}-\d{2}/

/** Like {@link localDayKey} but returns null for anything that is not a valid `yyyy-MM-dd` or ISO instant. */
export function safeLocalDayKey(isoOrDate: unknown): string | null {
  if (typeof isoOrDate !== 'string' || !DAY_PREFIX.test(isoOrDate)) return null
  if (isoOrDate.length === 10) return Number.isNaN(Date.parse(isoOrDate)) ? null : isoOrDate
  const d = new Date(isoOrDate)
  return Number.isNaN(d.getTime()) ? null : format(d, 'yyyy-MM-dd')
}
