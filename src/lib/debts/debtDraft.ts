import type { Debt } from '@/lib/store/types'

/** The typed fields of the add or edit debt sheet that make closing it ask to discard. */
export interface DebtDraft {
  amount: string
  person: string
  name: string
  item: string
}

export const BLANK_DEBT_DRAFT: DebtDraft = { amount: '', person: '', name: '', item: '' }

/** The draft an edit sheet opens with, mirroring its prefill. */
export function draftOfDebt(d: Debt): DebtDraft {
  return {
    amount: String(d.startingBalance ?? ''),
    person: d.personName ?? d.person ?? '',
    name: d.name ?? '',
    item: d.debtType === 'installment' ? d.name ?? '' : '',
  }
}

const num = (s: string) => {
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/** True when something was typed or changed since the sheet opened. */
export function debtDraftDirty(now: DebtDraft, from: DebtDraft): boolean {
  return (
    Math.abs(num(now.amount) - num(from.amount)) > 1e-9 ||
    now.person.trim() !== from.person.trim() ||
    now.name.trim() !== from.name.trim() ||
    now.item.trim() !== from.item.trim()
  )
}

export type DebtDraftMissing = 'amount' | 'person' | 'item'

/** Why a new borrow or installment can't be added yet; null when only plan fields block it, or nothing does. */
export function debtDraftMissing(kind: 'personal' | 'installment', d: DebtDraft): DebtDraftMissing | null {
  if (num(d.amount) <= 0) return 'amount'
  if (kind === 'personal' && !d.person.trim()) return 'person'
  if (kind === 'installment' && !d.item.trim()) return 'item'
  return null
}
