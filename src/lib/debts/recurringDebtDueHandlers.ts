import { addDays, format, parseISO } from 'date-fns'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency } from '@/lib/store/types'
import { computeDebtPaymentRecord, isDebtFullyPaid } from '@/lib/utils/calculations'
import { advanceRecurringDebtDueDate } from '@/lib/utils/recurringDebtPayments'

/**
 * User confirmed a scheduled debt payment: log payment + expense, advance next due date.
 */
export function confirmRecurringDebtPayment(scheduleId: string): boolean {
  const state = useFinanceStore.getState()
  const due = state.recurringDebtPayments.find((r) => r.id === scheduleId)
  if (!due?.isActive) return false

  const debt = state.debts.find((d) => d.id === due.debtId)
  if (!debt || isDebtFullyPaid(debt, state.debtPayments)) {
    state.updateRecurringDebtPayment(scheduleId, { isActive: false })
    return false
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
  if (!result.ok) return false

  const pmId =
    due.paymentMethodId ||
    state.paymentMethods.find((m) => m.isDefault)?.id ||
    state.paymentMethods[0]?.id ||
    ''

  const paymentDate = due.nextDueDate

  state.addDebtPaymentWithExpense(
    {
      debtId: due.debtId,
      date: paymentDate,
      amountPaid: result.amountInDebtUnit,
      paymentCurrency: due.currency,
      originalAmount: due.amount,
      amountInPrimary: result.amountInBase,
      rateAtEntry: result.rateAtEntry,
      notes: due.notes ? `Recurring · ${due.notes}` : 'Recurring debt payment',
    },
    {
      date: paymentDate,
      description: `${debt.name} — debt payment`,
      category: 'Debt',
      amount: due.amount,
      currency: due.currency as Currency,
      paymentMethodId: pmId,
      isRecurring: false,
      notes: due.notes,
      linkedDebtId: due.debtId,
      isDebtPayment: true,
    }
  )

  const next = advanceRecurringDebtDueDate(due.nextDueDate, due.frequency)
  state.updateRecurringDebtPayment(scheduleId, { nextDueDate: next })
  return true
}

/**
 * Snooze reminder by one calendar day (next due date moves forward).
 */
export function snoozeRecurringDebtPayment(scheduleId: string): void {
  const state = useFinanceStore.getState()
  const due = state.recurringDebtPayments.find((r) => r.id === scheduleId)
  if (!due) return
  const base = parseISO(due.nextDueDate + 'T12:00:00')
  const next = format(addDays(base, 1), 'yyyy-MM-dd')
  state.updateRecurringDebtPayment(scheduleId, { nextDueDate: next })
}
