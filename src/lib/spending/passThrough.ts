import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense, IncomeEvent } from '@/lib/store/types'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import { findPassThroughPairs, type MoneyLeg } from '@/lib/sms/passThrough'
import { settlePrompt } from '@/lib/prompts/settle'

/**
 * Pass-through money in the ledger (docs/launch/S1-sms-audit.md 6a.2): a bank-message credit and a bank-message
 * transfer out of the same amount on one account, minutes apart. The pair is only LABELLED until the user answers
 * once; the answer is remembered. "Yes" leaves both legs out of income and spending (balances still move), and each
 * leg can be counted again on its own.
 */

/** Remembered answers (synced with the other settled prompts). */
export const PASS_THROUGH_YES = 'passthrough:yes'
export const PASS_THROUGH_NO = 'passthrough:no'

export type PassThroughAnswer = 'yes' | 'no' | null

export function passThroughAnswer(promptState: Record<string, string> | undefined): PassThroughAnswer {
  if (promptState?.[PASS_THROUGH_YES]) return 'yes'
  return promptState?.[PASS_THROUGH_NO] ? 'no' : null
}

export interface LedgerPair { expenseId: string; incomeId: string }

/** Categories a transfer to another person is booked under. A purchase is never one leg of a relay. */
const OUT_CATEGORIES = new Set(['Instapay', 'Remittance'])
const RECEIVED = new Set(['confirmed', 'late', 'partial'])
/** Rows the server could not place share one "no account" bucket: the same unknown account is the likeliest reading. */
const accountOf = (id: string | undefined) => (!id || id === DEFAULT_CASH_ID ? 'unassigned' : id)

/**
 * Pairs still waiting for an answer: both legs came from bank messages with an exact time, the expense is a transfer
 * out that still counts as spending, and the credit is a one-off that still counts as income.
 */
export function pendingPassThroughPairs(expenses: readonly Expense[], incomeEvents: readonly IncomeEvent[]): LedgerPair[] {
  const legs: MoneyLeg[] = []
  for (const e of expenses) {
    if (!e.smsLogId || !e.occurredAt || e.refundKind || e.spendExclusion || !OUT_CATEGORIES.has(e.category)) continue
    legs.push({ id: e.id, owner: 'me', dir: 'out', amount: e.amount, currency: String(e.currency), account: accountOf(e.paymentMethodId), at: Date.parse(e.occurredAt) })
  }
  for (const i of incomeEvents) {
    if (!i.smsLogId || !i.occurredAt || i.templateId || i.exclusion || !RECEIVED.has(i.status)) continue
    legs.push({ id: i.id, owner: 'me', dir: 'in', amount: i.amount, currency: String(i.currency), account: accountOf(i.paymentMethodId), at: Date.parse(i.occurredAt) })
  }
  return findPassThroughPairs(legs).map((p) => ({ expenseId: p.outId, incomeId: p.inId }))
}

const store = () => useFinanceStore.getState()

/**
 * Leaves the pairs out of spending and income. The expense is marked as paid for someone and already covered (the
 * app's existing "not my spending" state), the credit as pass-through. Returns Undo for exactly these rows.
 */
export function applyPassThrough(pairs: readonly LedgerPair[]): () => void {
  const now = new Date().toISOString()
  for (const p of pairs) {
    store().updateExpense(p.expenseId, { spendExclusion: 'for_someone', owedSettledAt: now })
    store().updateIncomeEvent(p.incomeId, { exclusion: 'pass_through' })
  }
  return () => {
    for (const p of pairs) {
      store().updateExpense(p.expenseId, { spendExclusion: undefined, owedSettledAt: undefined })
      store().updateIncomeEvent(p.incomeId, { exclusion: null })
    }
  }
}

/** Records the one answer. "Yes" also applies it to the pairs found so far and returns their Undo. */
export function answerPassThrough(answer: 'yes' | 'no', pairs: readonly LedgerPair[]): (() => void) | null {
  settlePrompt(answer === 'yes' ? PASS_THROUGH_YES : PASS_THROUGH_NO)
  return answer === 'yes' ? applyPassThrough(pairs) : null
}
