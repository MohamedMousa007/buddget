import { differenceInCalendarDays, format, startOfMonth, subMonths } from 'date-fns'
import { getMonthRange } from '@/lib/utils/calculations'

export const PAY_CYCLE_MIN_DAY = 1
export const PAY_CYCLE_MAX_DAY = 28

export interface CycleView {
  /** `yyyy-MM` of the month the cycle STARTS in: the app's month key. */
  key: string
  start: Date
  end: Date
  /** 1-based day of the cycle that `today` is on. */
  elapsedDays: number
  totalDays: number
}

/** The month key of the cycle `today` falls in. Day 1 is the calendar month. */
export function cycleKeyFor(today: Date, startDay: number): string {
  const day = Math.min(PAY_CYCLE_MAX_DAY, Math.max(PAY_CYCLE_MIN_DAY, Math.round(startDay)))
  if (day <= 1 || today.getDate() >= day) return format(today, 'yyyy-MM')
  return format(subMonths(startOfMonth(today), 1), 'yyyy-MM')
}

export function currentCycle(today: Date, startDay: number): CycleView {
  const key = cycleKeyFor(today, startDay)
  const { start, end } = getMonthRange(key, startDay)
  return {
    key,
    start,
    end,
    elapsedDays: differenceInCalendarDays(today, start) + 1,
    totalDays: differenceInCalendarDays(end, start) + 1,
  }
}
