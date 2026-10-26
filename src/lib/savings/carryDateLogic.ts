/**
 * Which budget cycles does the month-end carry owe a user, and over what dates?
 *
 * A cycle starts on `monthStartDay` each month (clamped to 1-28 so it exists in every month, matching
 * `getMonthRange`) and closes at the next start. It is carried from the day AFTER its boundary, judged
 * in the user's local calendar date rather than UTC. The carry is catch-up based: every closed cycle
 * without a summary row is owed, so a missed run or a day that never exists (start 28 + 1 in a
 * non-leap February) only delays the carry instead of dropping it.
 *
 * Month keys are 'YYYY-MM', keyed by the month the cycle STARTED in.
 */
export const CARRY_TIME_ZONE = 'Africa/Cairo'
/** Most cycles a single run will catch up, so a long outage cannot sweep unbounded history. */
const MAX_CATCH_UP = 3

const clampStartDay = (d: number) => Math.min(28, Math.max(1, Math.floor(d) || 1))
const keyOf = (y: number, m0: number) => {
  const d = new Date(Date.UTC(y, m0, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Today's calendar date in `timeZone`, as a UTC-midnight timestamp so it compares with cycle dates. */
function localDayMs(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  return Date.UTC(get('year'), get('month') - 1, get('day'))
}

/** Closed-cycle keys at `now`, newest first, length `count`. A cycle counts as closed once a full day has passed its end. */
export function closedCycleKeys(now: Date, monthStartDay: number, count: number, timeZone = CARRY_TIME_ZONE): string[] {
  const start = clampStartDay(monthStartDay)
  const today = localDayMs(now, timeZone)
  const t = new Date(today)
  const y = t.getUTCFullYear()
  let m0 = t.getUTCMonth() - 1
  const closed = (cy: number, cm0: number) => today >= Date.UTC(cy, cm0 + 1, start) + 24 * 3600 * 1000
  while (!closed(y, m0)) m0--
  return Array.from({ length: count }, (_, i) => keyOf(y, m0 - i))
}

/**
 * Cycles to carry now, oldest first: closed cycles newer than the user's latest summary row (at most
 * MAX_CATCH_UP). A user with no summary yet gets only the newest closed cycle, never their history.
 */
export function pendingCarryKeys(now: Date, monthStartDay: number, latestDoneKey: string | null, timeZone = CARRY_TIME_ZONE): string[] {
  const candidates = closedCycleKeys(now, monthStartDay, MAX_CATCH_UP, timeZone)
  const owed = latestDoneKey === null ? candidates.slice(0, 1) : candidates.filter((k) => k > latestDoneKey)
  return owed.reverse()
}

/** The [start, end) date range of the cycle identified by `monthKey` + `monthStartDay`. */
export function cycleRange(monthKey: string, monthStartDay: number): { start: Date; end: Date } {
  const start = clampStartDay(monthStartDay)
  const [y, m] = monthKey.split('-').map(Number)
  return { start: new Date(Date.UTC(y, m - 1, start)), end: new Date(Date.UTC(y, m, start)) }
}
