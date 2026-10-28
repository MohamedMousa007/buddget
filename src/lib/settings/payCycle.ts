import { differenceInCalendarDays } from 'date-fns'
import { budgetMonthKeyFor, getMonthRange } from '@/lib/utils/calculations'

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
  return budgetMonthKeyFor(today, day)
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
