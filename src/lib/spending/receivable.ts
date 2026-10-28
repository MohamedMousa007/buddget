import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense, IncomeEvent } from '@/lib/store/types'
import { tryConvertCurrency } from '@/lib/utils/currency'

const DAY = 86_400_000
const WINDOW_DAYS = 60

/** True while an expense paid for someone is still waiting to be paid back. */
export const isOwed = (e: Pick<Expense, 'spendExclusion' | 'owedSettledAt'>): boolean => e.spendExclusion === 'for_someone' && !e.owedSettledAt

/**
 * Incoming one-off payments that could be the repayment: received after the expense, in the account's currency,
 * not salary-style recurring income and not tied to a debt. Closest amount first.
 */
export function repaymentCandidates(expense: Expense, incomes: readonly IncomeEvent[], accountCurrency: string, limit = 4): IncomeEvent[] {
  const from = new Date(`${expense.date.slice(0, 10)}T00:00:00`).getTime()
  return incomes
    .filter((i) => ['confirmed', 'late', 'partial'].includes(i.status)
      && !i.templateId && !i.linkedDebtId && !i.linkedSavingsAccountId
      && String(i.currency) === accountCurrency
      && new Date(`${i.receivedDate.slice(0, 10)}T00:00:00`).getTime() >= from - DAY
      && new Date(`${i.receivedDate.slice(0, 10)}T00:00:00`).getTime() <= from + WINDOW_DAYS * DAY)
    .sort((a, b) => Math.abs(a.amount - expense.amount) - Math.abs(b.amount - expense.amount))
    .slice(0, limit)
}

/**
 * Books a repayment: the money lands in the account as an adjustment (never as income, so earnings stay true) and the
 * expense is marked settled. When the payment was already captured as income (a bank text), that income row is
 * replaced by the adjustment so the balance is not credited twice.
 */
export function recordRepayment(args: { expenseId: string; accountId: string; amount: number; fromIncomeId?: string }): boolean {
  const s = useFinanceStore.getState()
  const expense = s.expenses.find((e) => e.id === args.expenseId)
  const account = s.paymentMethods.find((m) => m.id === args.accountId)
  if (!expense || !account || !(args.amount > 0)) return false
  const now = new Date().toISOString()
  const income = args.fromIncomeId ? s.incomeEvents.find((i) => i.id === args.fromIncomeId) : undefined
  if (income) s.deleteIncomeEvent(income.id)
  const delta = income ? tryConvertCurrency(income.amount, income.currency, String(account.currency), s.exchangeRates) ?? income.amount : args.amount
  s.addAccountAdjustment({
    paymentMethodId: account.id,
    delta,
    reason: 'manual_update',
    occurredAt: income ? new Date(`${income.receivedDate.slice(0, 10)}T12:00:00`).toISOString() : now,
    note: `Repaid${expense.owedBy ? ` by ${expense.owedBy}` : ''}: ${expense.description}`.slice(0, 120),
  })
  s.updateExpense(expense.id, { owedSettledAt: now })
  return true
}
