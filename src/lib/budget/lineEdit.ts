import type { BudgetPlanCategory, Currency } from '@/lib/store/types'

export interface LineEditInput {
  /** The amount the sheet showed, in base (a row in another currency is converted for display). */
  shown: number
  /** The amount the sheet now holds, in base. */
  value: number
  base: Currency
  linked: boolean
  essential: boolean
  locked: boolean
  isBill: boolean
  dueDay: number | null
}

/**
 * What a line edit writes. The amount field is in base, so a changed amount also moves the row to base;
 * an untouched amount is left alone so a row kept in another currency is not rewritten as base money.
 */
export function lineEditPatch(i: LineEditInput): Partial<BudgetPlanCategory> {
  const patch: Partial<BudgetPlanCategory> = { essential: i.essential, locked: i.locked }
  if (!i.linked && i.value !== i.shown) {
    patch.amount = i.value
    patch.currency = i.base
  }
  if (i.isBill) patch.dueDay = i.dueDay
  return patch
}

/** Plan amounts shown and proposed on the page are base money, so an amount patch carries base as its currency. */
export function patchInBase(patch: Partial<BudgetPlanCategory>, base: Currency): Partial<BudgetPlanCategory> {
  return patch.amount !== undefined && patch.currency === undefined ? { ...patch, currency: base } : patch
}
