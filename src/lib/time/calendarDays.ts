import { addMonths, addYears, differenceInCalendarDays, parseISO } from 'date-fns'

/**
 * Calendar-day arithmetic on local dates.
 *
 * date-fns `addDays`/`addWeeks` keep the time of day, so a date built from the Cairo DST-start Friday
 * (where local 00:00 does not exist and the clock reads 01:00) hands that 01:00 to every date derived
 * from it, and a 00:00 comparison then misses it. These helpers rebuild the date from its y/m/d fields,
 * so the result is always the local midnight of the target day.
 */
export function addCalendarDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

export function addCalendarWeeks(d: Date, n: number): Date {
  return addCalendarDays(d, 7 * n)
}

/** Local midnight of the calendar date in a `yyyy-MM-dd` string (or the date part of an ISO string); `new Date(str)` would read it as UTC midnight. */
export function parseDateOnly(s: string): Date {
  return parseISO(s.slice(0, 10))
}

const atNoon = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12)
const atMidnight = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export function addCalendarMonths(d: Date, n: number): Date {
  return atMidnight(addMonths(atNoon(d), n))
}

export function addCalendarYears(d: Date, n: number): Date {
  return atMidnight(addYears(atNoon(d), n))
}

/** Whole 7-day periods from `start` to `now`, by calendar days (a Saturday start has no period elapsed on Sunday). */
export function weeksElapsed(now: Date, start: Date): number {
  return Math.max(0, Math.floor(differenceInCalendarDays(now, start) / 7))
}
