import type { BudgetBlock, BudgetPlan, Currency } from '@/lib/store/types'
import { BUDGET_BLOCKS, lineBlock, planTotal, blockTotals } from '@/lib/budget/blocks'
import { effectivePlanCategoryAmountInBase } from '@/lib/budget/budgetPlans'

export interface BlockCompare {
  block: BudgetBlock
  a: number
  b: number
  delta: number
}

export interface LineCompare {
  block: BudgetBlock
  name: string
  a: number | null
  b: number | null
  delta: number
}

export interface PlanComparison {
  totalA: number
  totalB: number
  blocks: BlockCompare[]
  /** Only lines that differ (changed amount, or present in one plan only), biggest change first. */
  lines: LineCompare[]
}

const key = (block: BudgetBlock, name: string) => `${block}:${name.trim().toLowerCase()}`

/** Block totals and line-level differences between two plans, matched by block and name. */
export function comparePlans(a: BudgetPlan, b: BudgetPlan, base: Currency, rates: Record<string, number>): PlanComparison {
  const ta = blockTotals(a, base, rates)
  const tb = blockTotals(b, base, rates)
  const lineMap = (plan: BudgetPlan) =>
    new Map(plan.categories.map((c) => [key(lineBlock(c), c.name), { block: lineBlock(c), name: c.name, amount: effectivePlanCategoryAmountInBase(c, base, rates) }]))
  const la = lineMap(a)
  const lb = lineMap(b)
  const keys = new Set([...la.keys(), ...lb.keys()])
  const lines: LineCompare[] = []
  for (const k of keys) {
    const x = la.get(k)
    const y = lb.get(k)
    const delta = (y?.amount ?? 0) - (x?.amount ?? 0)
    if (x && y && Math.abs(delta) < 0.5) continue
    lines.push({ block: (x ?? y)!.block, name: (x ?? y)!.name, a: x?.amount ?? null, b: y?.amount ?? null, delta })
  }
  lines.sort((p, q) => Math.abs(q.delta) - Math.abs(p.delta))
  return {
    totalA: planTotal(ta),
    totalB: planTotal(tb),
    blocks: BUDGET_BLOCKS.map((block) => ({ block, a: ta[block], b: tb[block], delta: tb[block] - ta[block] })),
    lines,
  }
}
