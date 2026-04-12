import { addMonths, addQuarters, addWeeks, addYears, format, parseISO } from 'date-fns'
import type { Debt } from '@/lib/store/types'

/**
 * Number of installment periods already covered by logged payments (capped by plan length).
 */
export function installmentPaymentsCompleted(debt: Debt, paymentCount: number): number {
  if (debt.debtType !== 'installment' || !debt.installmentCount) return 0
  return Math.min(debt.installmentCount, Math.max(0, paymentCount))
}

function addByFrequency(start: Date, freq: NonNullable<Debt['installmentFrequency']>, periods: number): Date {
  switch (freq) {
    case 'weekly':
      return addWeeks(start, periods)
    case 'monthly':
      return addMonths(start, periods)
    case 'quarterly':
      return addQuarters(start, periods)
    case 'annually':
      return addYears(start, periods)
    default:
      return addMonths(start, periods)
  }
}

/**
 * Next scheduled installment date after `paymentsLogged` payments (same calendar rules as the plan).
 */
export function nextInstallmentDueFormatted(
  debt: Debt,
  paymentsLogged: number
): string | null {
  if (debt.debtType !== 'installment' || !debt.startDate || !debt.installmentFrequency || !debt.installmentCount) {
    return null
  }
  const completed = installmentPaymentsCompleted(debt, paymentsLogged)
  if (completed >= debt.installmentCount) return null
  const start = parseISO(debt.startDate)
  const next = addByFrequency(start, debt.installmentFrequency, completed)
  return format(next, 'MMM d, yyyy')
}
