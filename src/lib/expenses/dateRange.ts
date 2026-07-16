import {
  differenceInCalendarDays,
  endOfDay,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
} from 'date-fns'
import { getMonthRange } from '@/lib/utils/calculations'

export type RangePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

export const RANGE_PRESETS: readonly RangePreset[] = ['today', 'yesterday', 'week', 'month', 'custom']

export interface ExpenseRange {
  preset: RangePreset
  /** yyyy-MM-dd, only meaningful for `custom`. */
  from: string | null
  to: string | null
}

export interface ResolvedRange {
  start: Date
  end: Date
}

/**
 * Resolves a range preset to concrete bounds.
 *
 * `month` deliberately delegates to {@link getMonthRange} rather than
 * `startOfMonth`, so a custom pay-cycle (`monthStartDay`) stays coherent with the
 * dashboard. `custom` falls back to the month when its bounds are missing/inverted.
 */
export function resolveRange(
  range: ExpenseRange,
  monthFilter: string,
  monthStartDay: number,
  ref: Date = new Date(),
): ResolvedRange {
  switch (range.preset) {
    case 'today':
      return { start: startOfDay(ref), end: endOfDay(ref) }
    case 'yesterday': {
      const y = subDays(ref, 1)
      return { start: startOfDay(y), end: endOfDay(y) }
    }
    case 'week':
      return { start: startOfWeek(ref), end: endOfWeek(ref) }
    case 'custom': {
      if (!range.from || !range.to) break
      const start = startOfDay(parseISO(range.from))
      const end = endOfDay(parseISO(range.to))
      if (end < start) break
      return { start, end }
    }
    case 'month':
      break
  }
  const { start, end } = getMonthRange(monthFilter, monthStartDay)
  return { start, end }
}

/**
 * Days the Avg/day figure divides by: the elapsed span, never the whole span for a
 * range that runs into the future. Minimum 1 — "Today" must divide by 1, not by the
 * 31 the old month-only `daysElapsed` would have returned.
 */
export function daysInRange({ start, end }: ResolvedRange, ref: Date = new Date()): number {
  const span = differenceInCalendarDays(end, start) + 1
  const elapsed = differenceInCalendarDays(ref < end ? ref : end, start) + 1
  return Math.max(1, Math.min(span, elapsed))
}

/** True when the range needs its own label/date text rather than the month picker's. */
export function isMonthPreset(range: ExpenseRange): boolean {
  return range.preset === 'month'
}

/** Compact numeric text for a custom range, e.g. "12 – 18 Jul". Kept numeric so it can be
 *  rendered in `font-mono-numbers` (unicode-bidi: isolate) and never scramble under Arabic. */
export function formatCustomRange({ start, end }: ResolvedRange): string {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  return sameMonth
    ? `${format(start, 'd')} – ${format(end, 'd MMM')}`
    : `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`
}
