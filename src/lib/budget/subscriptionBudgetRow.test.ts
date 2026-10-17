import { describe, expect, it } from 'vitest'
import type { BudgetPlan } from '@/lib/store/types'
import { categoriesForBudgetKey, categorySpendingForPlanRows, resolveBudgetKey } from '@/lib/budget/budgetPlans'
import { PREDEFINED_BUDGET_CATEGORIES } from '@/lib/budget/budgetPlannerPresets'

const row = (name: string) => ({ id: name, name, icon: '📱', amount: 500, subcategories: [] })
const plan = (...names: string[]): BudgetPlan => ({ id: 'p', name: 'P', createdAt: '', categories: names.map(row) })

describe('Subscriptions budget row (preset label) vs the Subscription expense category', () => {
  it('the "Add category" preset is spelled "Subscriptions"', () => {
    expect(PREDEFINED_BUDGET_CATEGORIES.some((c) => c.label === 'Subscriptions')).toBe(true)
  })

  it('counts SMS-linked Subscription spend against the Subscriptions preset row', () => {
    const out = categorySpendingForPlanRows({ Subscription: 270 }, plan('Subscriptions', 'Food'))
    expect(out.Subscriptions).toBe(270)
  })

  it('also counts it against a row spelled exactly "Subscription"', () => {
    expect(categorySpendingForPlanRows({ Subscription: 270 }, plan('Subscription')).Subscription).toBe(270)
  })

  it('resolves the category to the preset row for chips / caps', () => {
    expect(resolveBudgetKey('Subscription', ['Food', 'Subscriptions'])).toBe('Subscriptions')
    expect(categoriesForBudgetKey('Subscriptions', ['Subscriptions'])).toContain('Subscription')
  })

  it('does not double count when the plan has both Enjoyment and Subscriptions rows', () => {
    const out = categorySpendingForPlanRows({ Subscription: 100, Enjoyment: 50 }, plan('Enjoyment', 'Subscriptions'))
    expect(out.Subscriptions).toBe(100)
    // Enjoyment folds Subscription only when the plan has no dedicated Subscription row.
    expect(out.Enjoyment).toBe(50)
  })
})
