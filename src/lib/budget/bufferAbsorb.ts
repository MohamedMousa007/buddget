import type { PlanView } from '@/lib/budget/planView.types'
import type { BudgetPlanCategory, Currency } from '@/lib/store/types'
import { convertCurrency } from '@/lib/utils/currency'

const round2 = (n: number) => Math.round(n * 100) / 100

/** The plan's Buffer line: the remainder of income in the grow block, a plain line that can shrink in place. */
export function bufferLineOf(view: PlanView): BudgetPlanCategory | null {
  const lv = view.blocks.grow.lines.find((l) => l.line.name.trim().toLowerCase() === 'buffer')
  return lv && lv.line.subcategories.length === 0 && !lv.line.locked ? lv.line : null
}

/**
 * The Buffer is income minus everything else planned. When a change adds `deltaInBase` to the plan (a new line, a
 * raise), it first uses any free money, then takes the rest out of the Buffer, so adding a line never reads as
 * "over income" while the Buffer still holds money. Returns the Buffer's new amount (in its own currency), or null
 * when the Buffer stays as it is (no Buffer, the change is the Buffer itself, nothing to take).
 */
export function bufferAfterChange(
  view: PlanView,
  deltaInBase: number,
  rates: Record<string, number>,
  changedLineId?: string,
): { lineId: string; amount: number } | null {
  const buffer = bufferLineOf(view)
  if (!buffer || buffer.id === changedLineId || !(deltaInBase > 0)) return null
  const short = deltaInBase - Math.max(0, view.free)
  if (short <= 0) return null
  const cur: Currency = buffer.currency ?? view.base
  const bufferInBase = cur === view.base ? buffer.amount : convertCurrency(buffer.amount, cur, view.base, rates)
  const take = Math.min(short, bufferInBase)
  if (take <= 0) return null
  const leftInBase = bufferInBase - take
  return { lineId: buffer.id, amount: round2(cur === view.base ? leftInBase : convertCurrency(leftInBase, view.base, cur, rates)) }
}
