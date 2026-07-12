import { addDays, subDays, isWithinInterval } from 'date-fns'
import type { IncomeRecurringFrequency, IncomeSource } from '@/lib/store/types'

/**
 * Payday scheduling for recurring income sources. Fixed days-of-month semantics:
 * monthly = 1 payday, biweekly = 2 (semi-monthly style, e.g. 5th + 20th),
 * weekly = 4. Weekend paydays shift to the previous business day.
 *
 * Standalone module (no import from calculations.ts) so both calculations.ts and
 * incomeOccurrences.ts can build on it without a cycle.
 */

/** Paydays per month for a frequency (weekly capped at 4 by product decision). */
export function paydaysPerMonth(freq: IncomeRecurringFrequency | undefined): number {
  if (freq === 'weekly') return 4
  if (freq === 'biweekly') return 2
  return 1
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
 * Weekend rule: Sat/Sun paydays are paid the previous Friday. If that Friday
 * falls in the previous month (payday on the 1st/2nd), pay the following
 * Monday instead so the occurrence stays inside its own month.
 */
export function shiftToBusinessDay(d: Date): Date {
  const dow = d.getDay() // 0 Sun … 6 Sat
  if (dow !== 0 && dow !== 6) return d
  const back = subDays(d, dow === 6 ? 1 : 2)
  if (back.getMonth() === d.getMonth()) return back
  return addDays(d, dow === 6 ? 2 : 1)
}

/** Historical weekly behavior: anchor on dayOfMonth, walk ±7 days across the window. */
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
export function paydayDatesForWindow(source: IncomeSource, start: Date, end: Date): Date[] {
  const days = sourcePaydayDays(source)
  const raw = days ? datesFromDays(days, start, end) : legacyWeeklyWalk(source, start, end)

  const taken = new Set<number>()
  const out: Date[] = []
  for (const d of raw) {
    const shifted = shiftToBusinessDay(d)
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
export function expectedForWindow(source: IncomeSource, start: Date, end: Date): number {
  return paydayDatesForWindow(source, start, end).length * source.amount
}
