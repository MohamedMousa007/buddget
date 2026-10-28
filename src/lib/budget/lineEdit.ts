import type { BudgetPlanCategory, Currency } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'

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

/**
 * Turns a patch whose amount is base money into a write that fits the line it lands on.
 * A line with subcategories is scaled proportionally (its own amount is ignored when read), a plain line
 * in another currency gets the amount converted into its own currency. The line's currency is never flipped.
 */
export function patchAmountInBase(
  line: BudgetPlanCategory,
  patch: Partial<BudgetPlanCategory>,
  base: Currency,
  rates: Record<string, number>,
): Partial<BudgetPlanCategory> {
  if (patch.amount === undefined || patch.currency !== undefined) return patch
  const cur = line.currency ?? base
  const target = patch.amount
  if (line.subcategories.length === 0) {
    return { ...patch, amount: cur === base ? target : round2(convertCurrency(target, base, cur, rates)) }
  }
  const { amount: _amount, ...rest } = patch
  const currentBase = line.subcategories.reduce((sum, sub) => sum + convertCurrency(sub.amount, cur, base, rates), 0)
  if (currentBase <= 0) return { ...rest, amount: target, currency: base, subcategories: [] }
  const factor = target / currentBase
  return { ...rest, subcategories: line.subcategories.map((sub) => ({ ...sub, amount: round2(sub.amount * factor) })) }
}

const round2 = (n: number) => Math.round(n * 100) / 100
