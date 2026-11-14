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

/** Stored in a row's `smsFlagsAck`: the user wants this row counted, so it is never paired or labelled again. */
export const PASS_THROUGH_COUNTED = 'pass_through_counted'

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
const isKnownAccount = (id: string | undefined): id is string => Boolean(id) && id !== DEFAULT_CASH_ID
const accountOf = (id: string | undefined) => (isKnownAccount(id) ? id : 'unassigned')
const isCounted = (row: { smsFlagsAck?: string[] }) => Boolean(row.smsFlagsAck?.includes(PASS_THROUGH_COUNTED))

/**
 * Pairs still waiting for an answer: both legs came from bank messages with an exact time, the expense is a transfer
 * out that still counts as spending, and the credit is a one-off that still counts as income.
 */
export function pendingPassThroughPairs(expenses: readonly Expense[], incomeEvents: readonly IncomeEvent[]): LedgerPair[] {
  const legs: MoneyLeg[] = []
  for (const e of expenses) {
    if (!e.smsLogId || !e.occurredAt || e.refundKind || e.spendExclusion || !OUT_CATEGORIES.has(e.category)) continue
    legs.push({ id: e.id, owner: 'me', dir: 'out', amount: e.amount, currency: String(e.currency), account: accountOf(e.paymentMethodId), at: Date.parse(e.occurredAt), counted: isCounted(e) })
  }
  for (const i of incomeEvents) {
    if (!i.smsLogId || !i.occurredAt || i.templateId || i.exclusion || !RECEIVED.has(i.status)) continue
    legs.push({ id: i.id, owner: 'me', dir: 'in', amount: i.amount, currency: String(i.currency), account: accountOf(i.paymentMethodId), at: Date.parse(i.occurredAt), counted: isCounted(i) })
  }
  return findPassThroughPairs(legs).map((p) => ({ expenseId: p.outId, incomeId: p.inId }))
}

/**
 * Pairs a remembered "yes" may apply by itself: both legs are on the same known account. An unknown account proves
 * nothing, so every pair from the unassigned bucket stays labelled and counted until the user says so.
 */
export function rememberedYesPairs(expenses: readonly Expense[], incomeEvents: readonly IncomeEvent[], promptState: Record<string, string> | undefined): LedgerPair[] {
  if (passThroughAnswer(promptState) !== 'yes') return []
  const expenseById = new Map(expenses.map((e) => [e.id, e]))
  const incomeById = new Map(incomeEvents.map((i) => [i.id, i]))
  return pendingPassThroughPairs(expenses, incomeEvents).filter((p) => {
    const account = expenseById.get(p.expenseId)?.paymentMethodId
    return isKnownAccount(account) && account === incomeById.get(p.incomeId)?.paymentMethodId
  })
}

/** Pairs that carry the "possible pass-through" label: all of them until answered, the unproven ones after "yes", none after "no". */
export function labelledPassThroughPairs(expenses: readonly Expense[], incomeEvents: readonly IncomeEvent[], promptState: Record<string, string> | undefined): LedgerPair[] {
  const answer = passThroughAnswer(promptState)
  if (answer === 'no') return []
  const pending = pendingPassThroughPairs(expenses, incomeEvents)
  if (answer === null) return pending
  const applied = new Set(rememberedYesPairs(expenses, incomeEvents, promptState).map((p) => p.expenseId))
  return pending.filter((p) => !applied.has(p.expenseId))
}

/** A credit left out of income, with its expense leg when one still pairs with it. */
export interface ExcludedPair { expense?: Expense; income: IncomeEvent }

/**
 * Every credit currently left out as pass-through that the user has not counted, for the review list. A credit whose
 * other leg was edited, deleted or moved is listed alone: it is still out of income and the user should be told.
 */
export function excludedPassThroughPairs(expenses: readonly Expense[], incomeEvents: readonly IncomeEvent[]): ExcludedPair[] {
  const legs: MoneyLeg[] = []
  const expenseById = new Map<string, Expense>()
  const credits = incomeEvents.filter((i) => i.exclusion === 'pass_through' && !isCounted(i))
  for (const e of expenses) {
    if (!e.smsLogId || !e.occurredAt || e.refundKind || e.spendExclusion !== 'for_someone' || !e.owedSettledAt || !OUT_CATEGORIES.has(e.category) || isCounted(e)) continue
    expenseById.set(e.id, e)
    legs.push({ id: e.id, owner: 'me', dir: 'out', amount: e.amount, currency: String(e.currency), account: accountOf(e.paymentMethodId), at: Date.parse(e.occurredAt) })
  }
  for (const i of credits) {
    if (!i.occurredAt) continue
    legs.push({ id: i.id, owner: 'me', dir: 'in', amount: i.amount, currency: String(i.currency), account: accountOf(i.paymentMethodId), at: Date.parse(i.occurredAt) })
  }
  const partner = new Map(findPassThroughPairs(legs).map((p) => [p.inId, expenseById.get(p.outId)]))
  return credits.map((income) => ({ income, expense: partner.get(income.id) }))
}

const store = () => useFinanceStore.getState()

const withAck = (ack: string[] | undefined) => (ack?.includes(PASS_THROUGH_COUNTED) ? ack : [...(ack ?? []), PASS_THROUGH_COUNTED])
const withoutAck = (ack: string[] | undefined) => {
  const rest = (ack ?? []).filter((a) => a !== PASS_THROUGH_COUNTED)
  return rest.length > 0 ? rest : undefined
}
const rowOf = (id: string) => store().expenses.find((e) => e.id === id)
const eventOf = (id: string) => store().incomeEvents.find((i) => i.id === id)

/**
 * Counts the pairs again and records that on both rows, so nothing pairs or labels them a second time. This is what
 * every Undo and every "count it" does; a remembered "yes" cannot take them back out on its own.
 */
export function countPassThrough(pairs: readonly LedgerPair[]): void {
  for (const p of pairs) {
    store().updateExpense(p.expenseId, { spendExclusion: undefined, owedSettledAt: undefined, smsFlagsAck: withAck(rowOf(p.expenseId)?.smsFlagsAck) })
    store().updateIncomeEvent(p.incomeId, { exclusion: null, smsFlagsAck: withAck(eventOf(p.incomeId)?.smsFlagsAck) })
  }
}

/**
 * Leaves the pairs out of spending and income. The expense is marked as paid for someone and already covered (the
 * app's existing "not my spending" state), the credit as pass-through. Returns Undo for exactly these rows.
 */
export function applyPassThrough(pairs: readonly LedgerPair[]): () => void {
  const now = new Date().toISOString()
  for (const p of pairs) {
    store().updateExpense(p.expenseId, { spendExclusion: 'for_someone', owedSettledAt: now, smsFlagsAck: withoutAck(rowOf(p.expenseId)?.smsFlagsAck) })
    store().updateIncomeEvent(p.incomeId, { exclusion: 'pass_through', smsFlagsAck: withoutAck(eventOf(p.incomeId)?.smsFlagsAck) })
  }
  return () => countPassThrough(pairs)
}

/** The income sheet's per-row undo: counts the credit and, when it is half of a pair left out, its other leg too. */
export function countPassThroughCredit(incomeId: string): void {
  const pair = excludedPassThroughPairs(store().expenses, store().incomeEvents).find((p) => p.income.id === incomeId)
  if (pair?.expense) countPassThrough([{ expenseId: pair.expense.id, incomeId }])
  else store().updateIncomeEvent(incomeId, { exclusion: null, smsFlagsAck: withAck(eventOf(incomeId)?.smsFlagsAck) })
}

/** Records the one answer. "Yes" also applies it to the pairs found so far and returns their Undo. */
export function answerPassThrough(answer: 'yes' | 'no', pairs: readonly LedgerPair[]): (() => void) | null {
  settlePrompt(answer === 'yes' ? PASS_THROUGH_YES : PASS_THROUGH_NO)
  return answer === 'yes' ? applyPassThrough(pairs) : null
}
