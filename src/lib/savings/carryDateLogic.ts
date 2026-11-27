import { DEFAULT_USER_TIME_ZONE } from '@/lib/server/userTimeZone'

/**
 * Month-end cycles (LOGIC_SPEC §4.4). A cycle is `[start, end)` in calendar dates ('YYYY-MM-DD') of the user's time
 * zone. Boundaries fall on `month_start_day`, clamped to 1-28 so one exists in every month (matching `getMonthRange`).
 * A cycle has ended once its `end` date has begun locally. `month_end_due_users` (0362) mirrors `dueCycle` in SQL.
 */
export interface Cycle {
  start: string
  end: string
}

export const clampStartDay = (d: number) => Math.min(28, Math.max(1, Math.floor(d) || 1))

const iso = (y: number, m0: number, d: number) => new Date(Date.UTC(y, m0, d)).toISOString().slice(0, 10)
const parts = (date: string) => date.split('-').map(Number) as [number, number, number]

/** Today's calendar date in `timeZone`. */
export function localDay(now: Date, timeZone = DEFAULT_USER_TIME_ZONE): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (t: string) => p.find((x) => x.type === t)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** The first boundary of `startDay` strictly after `date`. */
function boundaryAfter(date: string, startDay: number): string {
  const [y, m] = parts(date)
  const d = clampStartDay(startDay)
  const same = iso(y, m - 1, d)
  return same > date ? same : iso(y, m, d)
}

/** The latest boundary of `startDay` at or before `date`. */
function boundaryAtOrBefore(date: string, startDay: number): string {
  const [y, m] = parts(date)
  const d = clampStartDay(startDay)
  const same = iso(y, m - 1, d)
  return same <= date ? same : iso(y, m - 2, d)
}

/** nextCycle(prev) = [prev.end, first boundary of the current start day strictly after prev.end) (T35). */
export function nextCycle(prevEnd: string, startDay: number): Cycle {
  return { start: prevEnd, end: boundaryAfter(prevEnd, startDay) }
}

/** The newest cycle that has ended by `today`, on the standard boundaries. */
export function newestClosedCycle(today: string, startDay: number): Cycle {
  const end = boundaryAtOrBefore(today, startDay)
  const [y, m] = parts(end)
  return { start: iso(y, m - 2, clampStartDay(startDay)), end }
}

/**
 * The cycle a user's month-end is owed for at `today`, or null. After a month-end row (its `cycle_end`) the next cycles
 * follow on from it and only the newest ended one is proposed; with none (a new user, or only legacy carry rows) it is
 * the newest ended standard cycle, never older history.
 */
export function dueCycle(latestEnd: string | null, startDay: number, today: string): Cycle | null {
  if (!latestEnd) return newestClosedCycle(today, startDay)
  let c = nextCycle(latestEnd, startDay)
  if (c.end > today) return null
  for (let n = nextCycle(c.end, startDay); n.end <= today; n = nextCycle(n.end, startDay)) c = n
  return c
}

/** Month key of a month-end row: its cycle's start date (two cycles can start in one month after a start-day change). */
export const cycleKey = (c: Cycle) => c.start

/** The range of a legacy carry row ('YYYY-MM', keyed by the month its cycle started in) on the current start day. */
export function legacyCycle(monthKey: string, startDay: number): Cycle {
  const [y, m] = monthKey.split('-').map(Number)
  const d = clampStartDay(startDay)
  return { start: iso(y, m - 1, d), end: iso(y, m, d) }
}

/** The instant a calendar date begins in `timeZone` (ms). */
export function startOfDayIn(date: string, timeZone = DEFAULT_USER_TIME_ZONE): number {
  const [y, m, d] = parts(date)
  const guess = Date.UTC(y, m - 1, d)
  const p = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(guess))
  const get = (t: string) => Number(p.find((x) => x.type === t)!.value)
  const offset = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - guess
  return guess - offset
}
