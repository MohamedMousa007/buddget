import type { Debt, DebtPayment, Expense, PaymentMethod } from '@/lib/store/types'
import { computeCreditCardOutstanding } from '@/lib/debt/computeCreditCardBalance'
import { instantOf } from './balance'
import { resolveAccountId } from './resolve'

/** What the card on the carousel adds to its account: a debit card spends the account's balance, a credit card owes its own. */
export type CardDetails =
  | { kind: 'debit' }
  | { kind: 'credit'; outstanding: number | null; limit: number | null; currency: string }
  | { kind: 'other' }

export function cardDetails(
  card: PaymentMethod,
  debts: readonly Debt[],
  expenses: Expense[],
  payments: DebtPayment[],
  rates: Record<string, number>,
): CardDetails {
  if (card.type === 'debit_card') return { kind: 'debit' }
  if (card.type !== 'credit_card') return { kind: 'other' }
  const debt = debts.find((d) => d.debtType === 'credit_card' && d.linkedPaymentMethodId === card.id)
  if (!debt) return { kind: 'credit', outstanding: null, limit: null, currency: String(card.currency) }
  return {
    kind: 'credit',
    outstanding: computeCreditCardOutstanding(debt, expenses, payments, rates),
    limit: debt.creditLimit ?? null,
    currency: String(debt.currency),
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
