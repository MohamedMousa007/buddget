import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { isNonSpendCategory } from '@/lib/constants/categoryMeta'
import { categoriesForBudgetKey, resolveBudgetKey } from '@/lib/budget/budgetPlans'

/** budgeted = a plan row with an amount; unassigned = no budget covers it; plain = the user has no plan. */
export type CategoryChipState = 'budgeted' | 'unassigned' | 'plain'

export interface OrderedCategory {
  /** Plan row name for budgeted rows, otherwise the expense category. */
  key: string
  state: CategoryChipState
  /** Spent ÷ cap (1.23 = 123%); `null` unless budgeted. */
  pct: number | null
  /** Spend attributed to this entry (the row's consumption when budgeted). */
  spent: number
  /** Expense categories a tap filters to (the row plus the aliases it absorbs). */
  members: string[]
}

export interface OrderedCategoriesInput {
  /** Plan row name → cap in base currency. Empty = no plan. */
  caps: Readonly<Record<string, number>>
  /** Plan row name → consumption (after folding aliases / unassigned spend into Other). */
  rowSpent: Readonly<Record<string, number>>
  /** Expense category → spend in the visible range. */
  spentByCategory: Readonly<Record<string, number>>
  defaults?: readonly string[]
}

/**
 * Budgeted rows first (most used first), then unassigned categories that have spend (most spent
 * first), then the remaining defaults in their canonical order. Alias children covered by a
 * budgeted parent are folded into it. Non-spend categories are never listed.
 */
export function orderedCategories({
  caps,
  rowSpent,
  spentByCategory,
  defaults = EXPENSE_ENTRY_CATEGORIES,
}: OrderedCategoriesInput): OrderedCategory[] {
  const rowNames = Object.keys(caps).filter((n) => n.trim() && !isNonSpendCategory(n))
  const hasPlan = rowNames.length > 0

  const budgeted: OrderedCategory[] = rowNames
    .filter((r) => caps[r] > 0)
    .map((r) => ({
      key: r,
      state: 'budgeted' as const,
      pct: (rowSpent[r] ?? 0) / caps[r],
      spent: rowSpent[r] ?? 0,
      members: categoriesForBudgetKey(r, rowNames),
    }))
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))

  const covered = (cat: string): boolean => {
    const row = resolveBudgetKey(cat, rowNames)
    return row != null && caps[row] > 0
  }
  const candidates = new Map<string, string>()
  for (const cat of [...Object.keys(spentByCategory), ...defaults, ...rowNames]) {
    const id = cat.trim().toLowerCase()
    if (id && !isNonSpendCategory(cat) && !covered(cat) && !candidates.has(id)) candidates.set(id, cat)
  }
  const rest: OrderedCategory[] = [...candidates.values()].map((cat) => ({
    key: cat,
    state: hasPlan ? ('unassigned' as const) : ('plain' as const),
    pct: null,
    spent: spentByCategory[cat] ?? 0,
    members: [cat],
  }))
  const withSpend = rest.filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent)
  const idle = rest.filter((c) => !(c.spent > 0))
  return [...budgeted, ...withSpend, ...idle]
}

/** Flat category list for the filter sheet: chip order, aliases expanded, then any other seen category. */
export function categoryFilterIds(ordered: readonly OrderedCategory[], seen: Iterable<string> = []): string[] {
  return [...new Set([...ordered.flatMap((c) => c.members), ...seen])]
}
