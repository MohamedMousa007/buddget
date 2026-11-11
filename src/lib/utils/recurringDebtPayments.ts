import { addMonths, addWeeks, format, getDaysInMonth, parseISO, setDate } from 'date-fns'
import type { DebtRecurringFrequency } from '@/lib/store/types'

/**
 * Month-based steps clamp (Jan 31 + 1 month = Feb 28). With `anchorDay`, a due date that sits on its
 * clamped anchor snaps back to the anchor in longer months, so the day never drifts to 28 for good.
 */
function addMonthsAnchored(d: Date, months: number, anchorDay?: number): Date {
  const next = addMonths(d, months)
  if (!anchorDay || d.getDate() !== Math.min(anchorDay, getDaysInMonth(d))) return next
  return setDate(next, Math.min(anchorDay, getDaysInMonth(next)))
}

/**
 * The scheduled date behind a due date that was snoozed forward: the latest anchor day (clamped to the month)
 * on or before it, this month or the previous one. Month-based schedules only; a due date that already sits on
 * its anchor, or has no anchor, comes back unchanged. Advancing from this keeps a snooze from moving the due day.
 */
export function scheduledDueDate(isoYmd: string, frequency: DebtRecurringFrequency, anchorDay?: number): string {
  if (!anchorDay || (frequency !== 'monthly' && frequency !== 'quarterly' && frequency !== 'annually')) return isoYmd
  const d = parseISO(isoYmd + 'T12:00:00')
  const onAnchor = (monthOffset: number) => {
    const m = addMonths(setDate(d, 1), monthOffset)
    return format(setDate(m, Math.min(anchorDay, getDaysInMonth(m))), 'yyyy-MM-dd')
  }
  const thisMonth = onAnchor(0)
  if (thisMonth <= isoYmd) return thisMonth
  const lastMonth = onAnchor(-1)
  return lastMonth <= isoYmd ? lastMonth : isoYmd
}

export function advanceRecurringDebtDueDate(
  isoYmd: string,
  frequency: DebtRecurringFrequency,
  anchorDay?: number
): string {
  const d = parseISO(isoYmd + 'T12:00:00')
  if (frequency === 'monthly') return format(addMonthsAnchored(d, 1, anchorDay), 'yyyy-MM-dd')
  if (frequency === 'biweekly') return format(addWeeks(d, 2), 'yyyy-MM-dd')
  if (frequency === 'weekly') return format(addWeeks(d, 1), 'yyyy-MM-dd')
  if (frequency === 'quarterly') return format(addMonthsAnchored(d, 3, anchorDay), 'yyyy-MM-dd')
  if (frequency === 'annually') return format(addMonthsAnchored(d, 12, anchorDay), 'yyyy-MM-dd')
  return format(addWeeks(d, 1), 'yyyy-MM-dd')
}

export function isRecurringDebtDue(nextDueDate: string): boolean {
  const ymd = format(new Date(), 'yyyy-MM-dd')
  return nextDueDate <= ymd
}

/** The day-of-month a schedule keeps across short months. Weekly and biweekly rows have none: their day moves every period. */
export function recurringDueDayFor(frequency: DebtRecurringFrequency, nextDueDate: string): number | undefined {
  return frequency === 'monthly' || frequency === 'quarterly' || frequency === 'annually' ? Number(nextDueDate.slice(8, 10)) : undefined
}
