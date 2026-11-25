import type { Debt, DebtPayment, Expense, PaymentMethod } from '@/lib/store/types'
import { computeCreditCardOutstanding } from '@/lib/debt/computeCreditCardBalance'
import { instantOf } from './balance'
import { resolveAccountId } from './resolve'

/** What the card on the carousel adds to its account: a debit card spends the account's balance, a credit card owes its own. */
export type CardDetails =
  | { kind: 'debit' }
  | { kind: 'credit'; outstanding: number | null; limit: number | null; currency: string; dueDay: number | null }
  /** A pay-later card's plan in Debts: instalments paid of the plan's count. */
  | { kind: 'bnpl'; debtId: string; paid: number; count: number }
  | { kind: 'other' }

/** What is left to spend on a credit card: limit minus owed, floored at zero; unknown without a limit. */
export function availableCredit(limit: number | null, outstanding: number | null): number | null {
  if (limit === null) return null
  return Math.max(0, Math.round((limit - (outstanding ?? 0)) * 100) / 100)
}

export function cardDetails(
  card: PaymentMethod,
  debts: readonly Debt[],
  expenses: Expense[],
  payments: DebtPayment[],
  rates: Record<string, number>,
): CardDetails {
  if (card.type === 'debit_card') return { kind: 'debit' }
  if (card.type === 'bnpl') {
    const plan = debts.find((d) => d.debtType === 'installment' && d.linkedPaymentMethodId === card.id && d.installmentCount)
    if (!plan) return { kind: 'other' }
    return { kind: 'bnpl', debtId: plan.id, paid: payments.filter((p) => p.debtId === plan.id).length, count: plan.installmentCount as number }
  }
  if (card.type !== 'credit_card') return { kind: 'other' }
  const debt = debts.find((d) => d.debtType === 'credit_card' && d.linkedPaymentMethodId === card.id)
  if (!debt) return { kind: 'credit', outstanding: null, limit: null, currency: String(card.currency), dueDay: null }
  return {
    kind: 'credit',
    outstanding: computeCreditCardOutstanding(debt, expenses, payments, rates),
    limit: debt.creditLimit ?? null,
    currency: String(debt.currency),
    dueDay: debt.paymentDueDay ?? null,
  }
}

/**
 * The five latest live expenses for the sheet: the selected card's own when a card is selected (even when it has none,
 * so swiping always changes what is shown), the whole account's when the add-card slot or no card is selected.
 */
export function sheetActivity(card: PaymentMethod | undefined, accountId: string, expenses: readonly Expense[], methods: readonly PaymentMethod[]): Expense[] {
  const live = expenses.filter((e) => !e.refundedAt)
  const mine = card ? live.filter((e) => e.paymentMethodId === card.id) : live.filter((e) => resolveAccountId(e.paymentMethodId, methods) === accountId)
  return mine.sort((a, b) => instantOf(b.occurredAt, b.date) - instantOf(a.occurredAt, a.date)).slice(0, 5)
}
