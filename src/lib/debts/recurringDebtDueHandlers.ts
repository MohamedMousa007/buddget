import { addDays, format, parseISO } from 'date-fns'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency } from '@/lib/store/types'
import { calculateDebtRemainingRaw, computeDebtPaymentRecord, isDebtFullyPaid } from '@/lib/utils/calculations'
import { advanceRecurringDebtDueDate } from '@/lib/utils/recurringDebtPayments'
import { isBnplPlan } from '@/lib/debt/bnpl'

/**
 * User confirmed a scheduled debt payment: log payment + expense, advance next due date.
 */
export function confirmRecurringDebtPayment(scheduleId: string): boolean {
  const state = useFinanceStore.getState()
  const due = state.recurringDebtPayments.find((r) => r.id === scheduleId)
  if (!due?.isActive) return false

  const debt = state.debts.find((d) => d.id === due.debtId)
  const balanceCtx = {
    expenses: state.expenses,
    exchangeRates: state.exchangeRates,
    allDebts: state.debts,
  }
  if (!debt || isDebtFullyPaid(debt, state.debtPayments, balanceCtx)) {
    state.updateRecurringDebtPayment(scheduleId, { isActive: false })
    return false
  }

  // Clamp the final installment to the remaining balance — rounding of
  // total ÷ count can make the last slice slightly exceed what's owed, which
  // computeDebtPaymentRecord would reject. (Only same-currency, the common case.)
  const remaining = calculateDebtRemainingRaw(debt, state.debtPayments, balanceCtx)
  const payAmount =
    due.currency === debt.currency && due.amount > remaining ? remaining : due.amount

  const result = computeDebtPaymentRecord(
    debt,
    payAmount,
    due.currency,
    state.settings.baseCurrency,
    state.exchangeRates,
    state.goldPricePerGram,
    state.debtPayments,
    balanceCtx
  )
  if (!result.ok) return false

  const pmId =
    due.paymentMethodId ||
    state.paymentMethods.find((m) => m.isDefault)?.id ||
    state.paymentMethods[0]?.id ||
    ''

  const paymentDate = due.nextDueDate
  const bnpl = isBnplPlan(debt, state.paymentMethods)

  const paymentPayload = {
    debtId: due.debtId,
    date: paymentDate,
    amountPaid: result.amountInDebtUnit,
    paymentCurrency: due.currency,
    originalAmount: payAmount,
    amountInPrimary: result.amountInBase,
    rateAtEntry: result.rateAtEntry,
    notes: due.notes ? `Recurring · ${due.notes}` : 'Recurring debt payment',
  }

  if (debt.debtType === 'credit_card') {
    // Charge already lives on the card — payment only, no expense.
    state.addDebtPayment(paymentPayload)
  } else {
    // BNPL plan: the purchase was counted as spend at checkout, so the settlement
    // is non-spend (`Installment`). Bank/other installment plans keep `Debt` spend.
    state.addDebtPaymentWithExpense(paymentPayload, {
      date: paymentDate,
      description: `${debt.name} — ${bnpl ? 'installment' : 'debt payment'}`,
      category: bnpl ? 'Installment' : 'Debt',
      amount: payAmount,
      currency: due.currency as Currency,
      paymentMethodId: pmId,
      isRecurring: false,
      notes: due.notes,
      linkedDebtId: due.debtId,
      isDebtPayment: true,
    })
  }

  // Deactivate the schedule + clear the debt the moment it's fully paid, so no
  // ghost reminder fires for a settled plan.
  const after = useFinanceStore.getState()
  const stillOwed = calculateDebtRemainingRaw(debt, after.debtPayments, {
    expenses: after.expenses,
    exchangeRates: after.exchangeRates,
    allDebts: after.debts,
  })
  if (stillOwed <= 1e-6) {
    after.updateRecurringDebtPayment(scheduleId, { isActive: false })
    after.clearDebt(debt.id)
  } else {
    const next = advanceRecurringDebtDueDate(due.nextDueDate, due.frequency)
    after.updateRecurringDebtPayment(scheduleId, { nextDueDate: next })
  }
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
