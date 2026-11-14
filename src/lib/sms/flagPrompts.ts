import type { Expense, IncomeEvent } from '@/lib/store/types'
import { openSmsFlags, type SmsFlag } from './smsFlags'

export type FlagRowKind = 'expense' | 'income'

/** Rows the user is asked about at once, so the prompt stack is never flooded. */
export const FLAG_PROMPT_ROW_CAP = 3

/** Flags that have an answer on each kind of row; a flag outside its kind is stamped by a newer server and ignored. */
const APPLICABLE: Record<FlagRowKind, readonly SmsFlag[]> = {
  expense: ['possible_duplicate', 'date_unsure', 'refund_unmatched', 'model_kind_unproven', 'cash_deposit'],
  income: ['possible_duplicate', 'date_unsure', 'model_kind_unproven'],
}

export interface FlagPromptTarget {
  kind: FlagRowKind
  id: string
  flag: SmsFlag
}

/** The open flags of one row that the app can ask about. */
export function askableFlags(row: { smsFlags?: string[]; smsFlagsAck?: string[] }, kind: FlagRowKind): SmsFlag[] {
  return openSmsFlags(row).filter((f) => APPLICABLE[kind].includes(f))
}

/** The flag a ledger row's badge names: the first open one, or null. */
export function firstOpenFlag(row: { smsFlags?: string[]; smsFlagsAck?: string[] }, kind: FlagRowKind): SmsFlag | null {
  return askableFlags(row, kind)[0] ?? null
}

/** One target per open flag on the most recent rows that carry any, newest row first. Pure: nothing is written. */
export function selectFlagPrompts(expenses: Expense[], incomes: IncomeEvent[], cap = FLAG_PROMPT_ROW_CAP): FlagPromptTarget[] {
  const rows = [
    ...expenses.map((e) => ({ kind: 'expense' as const, row: e, at: e.occurredAt ?? e.date })),
    ...incomes.map((i) => ({ kind: 'income' as const, row: i, at: i.occurredAt ?? i.receivedDate })),
  ]
  return rows
    .map((r) => ({ ...r, flags: askableFlags(r.row, r.kind) }))
    .filter((r) => r.flags.length > 0)
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, cap)
    .flatMap((r) => r.flags.map((flag) => ({ kind: r.kind, id: r.row.id, flag })))
}

/** Expenses that could be the purchase a refund credit returned: same currency and exact amount, never refunded. */
export function refundCandidates(expenses: Expense[], refund: Pick<Expense, 'id' | 'amount' | 'currency' | 'date'>): Expense[] {
  const day = (s: string) => Date.parse(`${s.slice(0, 10)}T00:00:00Z`)
  const refundDay = day(refund.date)
  const MS = 86_400_000
  return expenses
    .filter((e) => {
      if (e.id === refund.id || e.refundedAt || e.refundKind) return false
      if (e.currency !== refund.currency || Math.abs(e.amount - refund.amount) >= 0.005) return false
      const age = (refundDay - day(e.date)) / MS
      return age >= -2 && age <= 180
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
