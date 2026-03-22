import { addMonths, addWeeks, format, parseISO } from 'date-fns'
import type { DebtRecurringFrequency } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import {
  computeDebtPaymentRecord,
  isDebtFullyPaid,
} from '@/lib/utils/calculations'

export function advanceRecurringDebtDueDate(
  isoYmd: string,
  frequency: DebtRecurringFrequency
): string {
  const d = parseISO(isoYmd + 'T12:00:00')
  if (frequency === 'monthly') return format(addMonths(d, 1), 'yyyy-MM-dd')
  if (frequency === 'biweekly') return format(addWeeks(d, 2), 'yyyy-MM-dd')
  return format(addWeeks(d, 1), 'yyyy-MM-dd')
}

export function isRecurringDebtDue(nextDueDate: string): boolean {
  const ymd = format(new Date(), 'yyyy-MM-dd')
  return nextDueDate <= ymd
}

const MAX_APPLY_PASSES = 80

/**
 * Posts debt payments + Debt-category expenses for any active recurring schedule whose next due date is today or earlier.
 * Stops on the first conversion/rate error so the user can fix settings.
 */
export function applyDueRecurringDebtPayments(): void {
  for (let i = 0; i < MAX_APPLY_PASSES; i++) {
    const state = useFinanceStore.getState()
    const due = state.recurringDebtPayments.find(
      (r) => r.isActive && isRecurringDebtDue(r.nextDueDate)
    )
    if (!due) return

    const debt = state.debts.find((d) => d.id === due.debtId)
    if (!debt) {
      state.updateRecurringDebtPayment(due.id, { isActive: false })
      continue
    }

    if (isDebtFullyPaid(debt, state.debtPayments)) {
      state.updateRecurringDebtPayment(due.id, { isActive: false })
      continue
    }

    const result = computeDebtPaymentRecord(
      debt,
      due.amount,
      due.currency,
      state.settings.baseCurrency,
      state.exchangeRates,
      state.goldPricePerGram,
      state.debtPayments
    )

    if (!result.ok) return

    const paymentDate = due.nextDueDate
    const pmId =
      due.paymentMethodId ||
      state.paymentMethods.find((m) => m.isDefault)?.id ||
      state.paymentMethods[0]?.id ||
      ''

    state.addDebtPayment({
      debtId: due.debtId,
      date: paymentDate,
      amountPaid: result.amountInDebtUnit,
      paymentCurrency: due.currency,
      originalAmount: due.amount,
      amountInPrimary: result.amountInBase,
      rateAtEntry: result.rateAtEntry,
      notes: due.notes ? `Recurring · ${due.notes}` : 'Recurring debt payment',
    })

    state.addExpense({
      date: paymentDate,
      description: `Debt payment – ${debt.person}`,
      category: 'Debt',
      amount: due.amount,
      currency: due.currency,
      paymentMethodId: pmId,
      isRecurring: false,
      notes: due.notes,
    })

    const next = advanceRecurringDebtDueDate(due.nextDueDate, due.frequency)
    state.updateRecurringDebtPayment(due.id, { nextDueDate: next })
  }
}
