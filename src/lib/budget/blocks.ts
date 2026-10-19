import type {
  BudgetBlock,
  BudgetPlan,
  BudgetPlanCategory,
  Currency,
  ExpenseCategory,
} from '@/lib/store/types'
import { effectivePlanCategoryAmountInBase, isSavingsPlanCategory } from '@/lib/budget/budgetPlans'

/** The seven blocks, in the order the plan page shows them. */
export const BUDGET_BLOCKS: readonly BudgetBlock[] = [
  'bills',
  'subscriptions',
  'debts',
  'everyday',
  'safety',
  'goals',
  'grow',
]

/** The three chapters the plan page groups blocks into. */
export type BudgetChapter = 'mustPay' | 'live' | 'secure'

export const BLOCK_CHAPTER: Record<BudgetBlock, BudgetChapter> = {
  bills: 'mustPay',
  subscriptions: 'mustPay',
  debts: 'mustPay',
  everyday: 'live',
  safety: 'secure',
  goals: 'secure',
  grow: 'secure',
}

export const CHAPTERS: readonly BudgetChapter[] = ['mustPay', 'live', 'secure']

export interface BlockMeta {
  /** Lucide icon key (kebab-case) for the block header tile. */
  icon: string
  /** 1-6 index into the `--color-cat-N` ramp; 0 = neutral ink. */
  cat: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** Lines in this block are linked to another part of the app by default. */
  linked: boolean
}

export const BLOCK_META: Record<BudgetBlock, BlockMeta> = {
  bills: { icon: 'receipt', cat: 4, linked: false },
  subscriptions: { icon: 'rotate-cw-clock', cat: 6, linked: true },
  debts: { icon: 'landmark', cat: 3, linked: true },
  everyday: { icon: 'shopping-basket', cat: 5, linked: false },
  safety: { icon: 'shield-check', cat: 1, linked: true },
  goals: { icon: 'target', cat: 2, linked: true },
  grow: { icon: 'sprout', cat: 0, linked: false },
}

/** Ledger categories that count against a block's linked line by default. */
export const BLOCK_EXPENSE_CATEGORIES: Partial<Record<BudgetBlock, ExpenseCategory[]>> = {
  subscriptions: ['Subscription'],
  debts: ['Debt'],
}

/** The block a line lives in. Pre-v2 rows have none: savings rows read as `grow`, everything else `everyday`. */
export function lineBlock(c: BudgetPlanCategory): BudgetBlock {
  if (c.block) return c.block
  return isSavingsPlanCategory(c) ? 'grow' : 'everyday'
}

export function linesInBlock(plan: BudgetPlan, block: BudgetBlock): BudgetPlanCategory[] {
  return plan.categories.filter((c) => lineBlock(c) === block)
}

/** Sum of each block's lines in base currency. Every block is present (0 when empty). */
export function blockTotals(
  plan: BudgetPlan,
  base: Currency,
  rates: Record<string, number>
): Record<BudgetBlock, number> {
  const totals = Object.fromEntries(BUDGET_BLOCKS.map((b) => [b, 0])) as Record<BudgetBlock, number>
  for (const c of plan.categories) {
    totals[lineBlock(c)] += effectivePlanCategoryAmountInBase(c, base, rates)
  }
  return totals
}

export function chapterTotals(totals: Record<BudgetBlock, number>): Record<BudgetChapter, number> {
  const out: Record<BudgetChapter, number> = { mustPay: 0, live: 0, secure: 0 }
  for (const b of BUDGET_BLOCKS) out[BLOCK_CHAPTER[b]] += totals[b]
  return out
}

export function planTotal(totals: Record<BudgetBlock, number>): number {
  return BUDGET_BLOCKS.reduce((s, b) => s + totals[b], 0)
}

/** Income the plan is sized against: the user's override, else what the income sources project. */
export function planIncome(plan: BudgetPlan, projectedIncome: number): number {
  return plan.incomeOverride ?? projectedIncome
}

/** Income minus every line. Zero is "balanced"; negative is over-assigned. Rounded to cents. */
export function freeToAssign(income: number, totals: Record<BudgetBlock, number>): number {
  return Math.round((income - planTotal(totals)) * 100) / 100
}

/** Share of income as a 0-100 number; 0 when there is no income. */
export function percentOfIncome(amount: number, income: number): number {
  return income > 0 ? (amount / income) * 100 : 0
}
