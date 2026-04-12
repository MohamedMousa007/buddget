import { addMonths, addWeeks, addYears, format, parseISO } from 'date-fns'
import type { DebtRecurringFrequency } from '@/lib/store/types'

export function advanceRecurringDebtDueDate(
  isoYmd: string,
  frequency: DebtRecurringFrequency
): string {
  const d = parseISO(isoYmd + 'T12:00:00')
  if (frequency === 'monthly') return format(addMonths(d, 1), 'yyyy-MM-dd')
  if (frequency === 'biweekly') return format(addWeeks(d, 2), 'yyyy-MM-dd')
  if (frequency === 'weekly') return format(addWeeks(d, 1), 'yyyy-MM-dd')
  if (frequency === 'quarterly') return format(addMonths(d, 3), 'yyyy-MM-dd')
  if (frequency === 'annually') return format(addYears(d, 1), 'yyyy-MM-dd')
  return format(addWeeks(d, 1), 'yyyy-MM-dd')
}

export function isRecurringDebtDue(nextDueDate: string): boolean {
  const ymd = format(new Date(), 'yyyy-MM-dd')
  return nextDueDate <= ymd
}
