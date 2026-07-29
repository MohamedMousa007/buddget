/**
 * When does the month-end carry fire, and for which cycle?
 *
 * A budget cycle starts on `monthStartDay` each month. To dodge timezone edges (F2), the carry
 * runs ONE day after the cycle boundary — i.e. on `monthStartDay + 1`, by which point the boundary
 * has passed in every timezone the app serves. On that day it carries the cycle that just closed.
 *
 * Returns the closed cycle's month_key ('YYYY-MM', keyed by the month the cycle STARTED in), or
 * null when `now` is not a carry day for this user.
 */
export function justClosedCycleKey(now: Date, monthStartDay: number): string | null {
  const start = Math.min(28, Math.max(1, Math.floor(monthStartDay) || 1))
  // Fire the day after the boundary. monthStartDay ≤ 28, so +1 ≤ 29 — always a valid date.
  if (now.getUTCDate() !== start + 1) return null

  // The cycle that just closed started on `start` of the PREVIOUS month relative to now.
  // (On e.g. Aug 2 with start=1, the closed cycle ran Jul 1–Jul 31 → key 2026-07.)
  const started = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, start))
  return `${started.getUTCFullYear()}-${String(started.getUTCMonth() + 1).padStart(2, '0')}`
}

/** The [start, end) date range of the cycle identified by `monthKey` + `monthStartDay`. */
export function cycleRange(monthKey: string, monthStartDay: number): { start: Date; end: Date } {
  const start = Math.min(28, Math.max(1, Math.floor(monthStartDay) || 1))
  const [y, m] = monthKey.split('-').map(Number)
  const s = new Date(Date.UTC(y, m - 1, start))
  const e = new Date(Date.UTC(y, m, start)) // next month's start day
  return { start: s, end: e }
}
