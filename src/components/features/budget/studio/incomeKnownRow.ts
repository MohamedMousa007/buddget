import { questionById, type StudioState } from '@/lib/budget/infoGaps'
import type { BudgetFacts } from '@/lib/budget/facts'
import type { KnownRow } from './KnownSheet'

/** Known income is confirmed rather than asked, so it has no answer row of its own; tapping it reopens that confirm question. */
export function incomeKnownRow(merged: BudgetFacts, state: StudioState, label: string, money: (n: number) => string): KnownRow[] {
  const confirm = questionById('confirmIncome')
  if (!confirm || !confirm.askIf(merged, state)) return []
  return [{ id: confirm.id, label, value: money(merged.monthlyIncome) }]
}
