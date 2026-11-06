import { calculateDebtRemainingRaw } from '@/lib/utils/calculations'
import type { FinanceStore } from '@/lib/store/types'

/**
 * A payment landing on a cleared debt, or above what is still owed, is a duplicate or stale submit
 * (a second tap, an exiting sheet's old handler). Cards are exempt: they revolve and can be overpaid.
 * `amountPaid` is in the debt's own unit.
 */
export function overpaysDebt(
  state: Pick<FinanceStore, 'debts' | 'debtPayments' | 'expenses' | 'exchangeRates'>,
  payment: { debtId: string; amountPaid: number },
): boolean {
  const debt = state.debts.find((d) => d.id === payment.debtId)
  if (!debt || debt.debtType === 'credit_card') return false
  if (debt.status === 'cleared') return true
  const remaining = calculateDebtRemainingRaw(debt, state.debtPayments, { expenses: state.expenses, exchangeRates: state.exchangeRates, allDebts: state.debts })
  return payment.amountPaid > remaining + (debt.isGold ? 1e-4 : 0.005)
}
