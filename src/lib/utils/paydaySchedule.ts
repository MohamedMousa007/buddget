import { addDays, subDays, isWithinInterval } from 'date-fns'
import type { IncomeRecurringFrequency, IncomeSource } from '@/lib/store/types'

/**
 * Payday scheduling for recurring income sources. Fixed days-of-month semantics:
 * monthly = 1 payday, biweekly = 2 (semi-monthly style, e.g. 5th + 20th),
 * weekly = 4. Paydays on the employer weekend shift to the previous working day
 * (the weekend is Sat+Sun, or Fri+Sat where the week opens on Saturday; see {@link weekendFirstDayFor}).
 *
 * Standalone module (no import from calculations.ts) so both calculations.ts and
 * incomeOccurrences.ts can build on it without a cycle.
 */

/** JS weekday of the first of the two consecutive weekend days: Saturday (Sat+Sun) or Friday (Fri+Sat). */
export type WeekendFirstDay = 5 | 6

export const DEFAULT_WEEKEND_FIRST_DAY: WeekendFirstDay = 6

/** Weekly counts as 4 paydays a month on every screen, even in a month holding a fifth same-weekday. */
const WEEKLY_PAYDAY_CAP = 4

/** Paydays per month for a frequency (weekly capped at 4 by product decision). */
export function paydaysPerMonth(freq: IncomeRecurringFrequency | undefined): number {
  if (freq === 'weekly') return WEEKLY_PAYDAY_CAP
  if (freq === 'biweekly') return 2
  return 1
}

/** Paydays a source actually pays per month: its configured payday days, else the frequency default. */
export function monthlyPaydayCount(source: IncomeSource): number {
  return sourcePaydayDays(source)?.length ?? paydaysPerMonth(source.recurringFrequency)
}

/** Local-date `YYYY-MM-DD` (avoids the UTC shift of toISOString). */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Default payday days derived from the first tapped day: biweekly adds the
 * semi-monthly partner (+15, e.g. 5 → 20); weekly steps +7 wrapping past 31.
 * The user can override all slots manually in the payday grid.
 */
export function deriveDefaultPaydays(anchor: number, freq: IncomeRecurringFrequency | undefined): number[] {
  const a = Math.min(Math.max(Math.round(anchor) || 1, 1), 31)
  if (freq === 'biweekly') {
    const second = a + 15 <= 31 ? a + 15 : a - 15
    return [...new Set([a, second])].sort((x, y) => x - y)
  }
  if (freq === 'weekly') {
    const days = [0, 7, 14, 21].map((step) => {
      const d = a + step
      return d > 31 ? d - 28 : d
    })
    return [...new Set(days)].sort((x, y) => x - y).slice(0, 4)
  }
  return [a]
}

/**
 * The source's payday days of month, sorted. Legacy weekly rows (no stored
 * `paydayDays`) return null — callers keep the historical ±7-day walk so
 * existing cards don't shift.
 */
export function sourcePaydayDays(source: IncomeSource): number[] | null {
  if (source.paydayDays?.length) return [...source.paydayDays].sort((x, y) => x - y)
  const freq = source.recurringFrequency ?? 'monthly'
  if (freq === 'weekly') return null
  return deriveDefaultPaydays(source.dayOfMonth ?? 1, freq)
}

/**
 * Weekend rule: a payday on the first weekend day is paid the day before the weekend, one on the
 * second weekend day two days before (Sat/Sun → Friday; Fri/Sat → Thursday). If that day falls in
 * the previous month (payday on the 1st/2nd), pay the first working day after the weekend instead
 * so the occurrence stays inside its own month.
 */
export function shiftToBusinessDay(d: Date, weekendFirst: WeekendFirstDay = DEFAULT_WEEKEND_FIRST_DAY): Date {
  const dow = d.getDay() // 0 Sun … 6 Sat
  const second = (weekendFirst + 1) % 7
  if (dow !== weekendFirst && dow !== second) return d
  const first = dow === weekendFirst
  const back = subDays(d, first ? 1 : 2)
  if (back.getMonth() === d.getMonth()) return back
  return addDays(d, first ? 2 : 1)
}

/** The weekend shift, except a payday on a window edge moves the other way instead of out of its cycle. */
function shiftIntoWindow(d: Date, start: Date, end: Date, weekendFirst: WeekendFirstDay): Date {
  const shifted = shiftToBusinessDay(d, weekendFirst)
  if (shifted >= start && shifted <= end) return shifted
  const first = d.getDay() === weekendFirst
  const forward = addDays(d, first ? 2 : 1)
  if (forward >= start && forward <= end) return forward
  const back = subDays(d, first ? 1 : 2)
  return back >= start && back <= end ? back : d
}

/** Legacy weekly: anchor on dayOfMonth, walk ±7 days across the window (SMS matching keeps every date; budget windows cap at 4). */
function legacyWeeklyWalk(source: IncomeSource, start: Date, end: Date): Date[] {
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  const anchor = new Date(start.getFullYear(), start.getMonth(), Math.min(source.dayOfMonth ?? 1, daysInMonth))
  const dates: Date[] = []
  let cursor = anchor
  while (cursor >= start) cursor = addDays(cursor, -7)
  cursor = addDays(cursor, 7)
  while (cursor <= end) {
    if (cursor >= start) dates.push(cursor)
    cursor = addDays(cursor, 7)
  }
  return dates
}

/**
 * Sorted, business-day-adjusted payday dates for a source inside `[start, end]`
 * (the month window; may span two calendar months when `monthStartDay > 1`).
 * Days 29–31 clamp to the month's length; two days clamping to the same date
 * collapse to one payday. If a weekend shift would collide with an existing
 * payday, the later payday keeps its unshifted date so the count is preserved.
 */
export function paydayDatesForWindow(
  source: IncomeSource,
  start: Date,
  end: Date,
  cycle = true,
  weekendFirst: WeekendFirstDay = DEFAULT_WEEKEND_FIRST_DAY,
): Date[] {
  const days = sourcePaydayDays(source)
  const walked = days ? datesFromDays(days, start, end) : legacyWeeklyWalk(source, start, end)
  if (!days && cycle) walked.splice(WEEKLY_PAYDAY_CAP)
  // In a budget cycle a payday belongs to the window holding its calendar date, so a shifted one is never in two cycles.
  const raw = cycle ? walked.filter((d) => isWithinInterval(d, { start, end })) : walked

  const taken = new Set<number>()
  const out: Date[] = []
  for (const d of raw) {
    const shifted = cycle ? shiftIntoWindow(d, start, end, weekendFirst) : shiftToBusinessDay(d, weekendFirst)
    const pick = taken.has(shifted.getTime()) ? d : shifted
    if (taken.has(pick.getTime())) continue
    taken.add(pick.getTime())
    out.push(pick)
  }
  return out.filter((d) => isWithinInterval(d, { start, end })).sort((a, b) => a.getTime() - b.getTime())
}

function datesFromDays(days: number[], start: Date, end: Date): Date[] {
  const uniq = new Map<number, Date>()
  let y = start.getFullYear()
  let m = start.getMonth()
  while (new Date(y, m, 1) <= end) {
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    for (const day of days) {
      const d = new Date(y, m, Math.min(day, daysInMonth))
      uniq.set(d.getTime(), d)
    }
    m += 1
    if (m > 11) {
      m = 0
      y += 1
    }
  }
  return [...uniq.values()].sort((a, b) => a.getTime() - b.getTime())
}

/** Expected income for the window on the physical basis: payday count × per-paycheck amount. */
export function expectedForWindow(source: IncomeSource, start: Date, end: Date, weekendFirst?: WeekendFirstDay): number {
  return paydayDatesForWindow(source, start, end, true, weekendFirst).length * source.amount
}
