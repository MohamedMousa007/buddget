import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { PaymentMethod, SavingsTransaction } from '@/lib/store/types'
import { localTodayISO } from '@/lib/utils/localDate'
import { instantOf, type LedgerInput } from './balance'
import { isTracked } from './kinds'
import { resolveAccountId } from './resolve'

/** How the user explains a bank balance that is higher than the ledger. Each answer raises the ledger toward the bank. */
export type SurplusAnswer = 'income' | 'transfer' | 'pocket' | 'correct'

/**
 * Pocket deposits booked as money leaving this account (the pocket lives outside it) that can explain a surplus:
 * the app moved the money, the bank never did. Newest first, as many as fit inside the surplus.
 */
export function depositsThatNeverLeft(ledger: LedgerInput, accountId: string, surplus: number, reportedAt: string, tolerance = 1): SavingsTransaction[] {
  const until = new Date(reportedAt).getTime()
  const pockets = new Map(ledger.savingsAccounts.map((p) => [p.id, p]))
  const rows = ledger.savingsTransactions
    .filter((t) => t.type === 'deposit' && !!t.paymentMethodId && !t.transferGroupId
      && resolveAccountId(t.paymentMethodId, ledger.paymentMethods) === accountId
      && pockets.get(t.accountId)?.heldInPaymentMethodId !== accountId
      && instantOf(t.occurredAt, t.date) <= until)
    .sort((a, b) => instantOf(b.occurredAt, b.date) - instantOf(a.occurredAt, a.date))
  const picked: SavingsTransaction[] = []
  let total = 0
  for (const t of rows) {
    if (total + t.amount > surplus + tolerance) continue
    picked.push(t)
    total += t.amount
  }
  return picked
}

/** Accounts a "moved from another account" answer may debit: tracked, open, same currency, not this one. */
export function transferSources(methods: readonly PaymentMethod[], account: PaymentMethod): PaymentMethod[] {
  return methods.filter((m) => m.id !== account.id && isTracked(m) && !m.closedAt && String(m.currency) === String(account.currency))
}

export interface SurplusInput {
  account: PaymentMethod
  /** Positive: what the bank shows above the ledger. */
  amount: number
  /** The newest bank report; entries are dated just before it so that the report then matches. */
  reportedAt: string
  /** 'transfer': the account the money came from. */
  fromAccountId?: string
  /** 'pocket': the deposits to undo (from {@link depositsThatNeverLeft}). */
  deposits?: readonly SavingsTransaction[]
}

/** Records the answer. Returns false when nothing could be written. */
export function resolveSurplus(answer: SurplusAnswer, input: SurplusInput): boolean {
  const s = useFinanceStore.getState()
  const { account, amount } = input
  if (!(amount > 0)) return false
  const at = new Date(new Date(input.reportedAt).getTime() - 60_000)
  if (answer === 'income') {
    s.addIncomeEvent({ name: 'Unlogged income', amount, currency: account.currency, receivedDate: localTodayISO(at), occurredAt: at.toISOString(), status: 'confirmed', paymentMethodId: account.id })
    return true
  }
  if (answer === 'transfer') {
    if (!input.fromAccountId) return false
    s.addExpense({ description: 'Transfer', category: 'Transfer', amount, currency: account.currency, date: localTodayISO(at), occurredAt: at.toISOString(), paymentMethodId: input.fromAccountId, toPaymentMethodId: account.id, isRecurring: false })
    return true
  }
  if (answer === 'pocket') {
    let undone = false
    for (const t of input.deposits ?? []) undone = s.deleteSavingsTransaction(t.id).ok || undone
    return undone
  }
  s.addAccountAdjustment({ paymentMethodId: account.id, delta: Math.round(amount * 100) / 100, reason: 'gap', occurredAt: at.toISOString() })
  return true
}
