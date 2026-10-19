import type { BudgetBlock, BudgetLinkType, BudgetPlanCategory } from '@/lib/store/types'
import { categoriesForBudgetKey } from '@/lib/budget/budgetPlans'
import { lineIconKey } from '@/lib/budget/lineIcons'

export interface LegacyClass {
  block: BudgetBlock
  linkType: BudgetLinkType
  essential: boolean
  expenseCategories: string[]
}

const EMERGENCY = /emergency|safety net|rainy/i
const SUBSCRIPTIONS = /subscription/i
const DEBTS = /\b(debts?|loans?|cards?|installments?|instalments?|tabby|tamara|bnpl)\b/i
const GOALS = /\bgoals?\b/i
const GROW = /invest|zakat|charity|donation|sadaqa/i
export const HOUSING = /\b(rent|mortgage)\b/i
const UTILITIES = /\b(utilit|dewa|electric|water|internet|wifi|phone|mobile)/i
const OTHER_BILLS = /\b(insurance|school|tuition|nursery|childcare|bills?)\b/i

const BILL_CATEGORY: ReadonlyArray<[RegExp, string]> = [
  [HOUSING, 'Rent'],
  [UTILITIES, 'Utilities'],
  [/\b(school|tuition|nursery)/i, 'Education'],
]

const unique = (xs: string[]) => [...new Set(xs)]

/**
 * Best guess at where a pre-v2 row belongs. The row's own name always stays a counted category,
 * because old expenses are tagged with the plan row name.
 */
export function classifyLegacyLine(c: BudgetPlanCategory, rowNames: readonly string[] = [c.name]): LegacyClass {
  const name = c.name.trim()
  const own = categoriesForBudgetKey(name, rowNames)

  if (EMERGENCY.test(name)) return { block: 'safety', linkType: 'emergency', essential: false, expenseCategories: [] }
  if (SUBSCRIPTIONS.test(name)) {
    return { block: 'subscriptions', linkType: 'subscriptions', essential: false, expenseCategories: unique([name, 'Subscription']) }
  }
  if (DEBTS.test(name)) return { block: 'debts', linkType: 'debts', essential: true, expenseCategories: unique([name, 'Debt']) }
  if (GOALS.test(name)) return { block: 'goals', linkType: 'goal', essential: false, expenseCategories: [] }
  if (GROW.test(name) || c.isSavings === true) {
    return { block: 'grow', linkType: 'none', essential: false, expenseCategories: [] }
  }
  const billCategory = BILL_CATEGORY.find(([re]) => re.test(name))?.[1]
  if (billCategory || UTILITIES.test(name) || OTHER_BILLS.test(name)) {
    return { block: 'bills', linkType: 'none', essential: true, expenseCategories: unique([...own, ...(billCategory ? [billCategory] : [])]) }
  }
  return { block: 'everyday', linkType: 'none', essential: false, expenseCategories: own }
}

/** Gives every pre-v2 row a block, keeping ids and amounts. Rows that already have a block are untouched. */
export function upgradeLegacyLines(lines: BudgetPlanCategory[]): BudgetPlanCategory[] {
  const rowNames = lines.map((l) => l.name.trim())
  return lines.map((c) => {
    if (c.block) return c
    const k = classifyLegacyLine(c, rowNames)
    return {
      ...c,
      icon: lineIconKey(c.icon),
      block: k.block,
      linkType: k.linkType,
      linkIds: c.linkIds ?? [],
      essential: k.essential,
      expenseCategories: k.expenseCategories,
    }
  })
}
