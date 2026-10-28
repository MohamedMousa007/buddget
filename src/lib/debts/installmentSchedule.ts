import { formatLocalized, type AppLocale } from '@/lib/i18n/dateFormat'
import { addMonths, addQuarters, addWeeks, addYears, parseISO } from 'date-fns'
import type { Debt, DebtPayment } from '@/lib/store/types'

/**
 * Installments already covered, from the amount paid (debt units) over the per-installment amount,
 * capped by plan length. Rows are not installments: a half payment is not one, a double payment is two.
 */
export function installmentPaymentsCompleted(debt: Debt, payments: readonly DebtPayment[]): number {
  if (debt.debtType !== 'installment' || !debt.installmentCount) return 0
  const per = debt.installmentAmount ?? 0
  const done = per > 0
    ? Math.floor((payments.reduce((sum, p) => sum + p.amountPaid, 0) + 0.005) / per)
    : payments.length
  return Math.min(debt.installmentCount, Math.max(0, done))
}

export function addByFrequency(start: Date, freq: NonNullable<Debt['installmentFrequency']>, periods: number): Date {
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
 * Next scheduled installment date after `completed` installments (same calendar rules as the plan).
 */
export function nextInstallmentDueDate(debt: Debt, completed: number): Date | null {
  if (debt.debtType !== 'installment' || !debt.startDate || !debt.installmentFrequency || !debt.installmentCount) {
    return null
  }
  if (completed >= debt.installmentCount) return null
  return addByFrequency(parseISO(debt.startDate), debt.installmentFrequency, completed)
}

export function nextInstallmentDueFormatted(debt: Debt, completed: number, locale: AppLocale = 'en'): string | null {
  const due = nextInstallmentDueDate(debt, completed)
  return due ? formatLocalized(due, 'MMM d, yyyy', locale) : null
}
