import { describe, expect, it } from 'vitest'
import type { BudgetPlan } from '@/lib/store/types'
import {
  isSavingsPlanCategory,
  totalPlannedExpensesForPlan,
  totalPlannedSavingsAllocationForPlan,
} from '@/lib/budget/budgetPlans'

const basePlan = (categories: BudgetPlan['categories']): BudgetPlan => ({
  id: 'p1',
  name: 'Test',
  createdAt: '',
  categories,
})

describe('isSavingsPlanCategory', () => {
  it('uses isSavings when set', () => {
    expect(
      isSavingsPlanCategory({
        id: '1',
        name: 'Rainy day',
        icon: '💰',
        amount: 100,
        isSavings: true,
        subcategories: [],
      })
    ).toBe(true)
    expect(
      isSavingsPlanCategory({
        id: '2',
        name: 'Savings',
        icon: '💰',
        amount: 100,
        isSavings: false,
        subcategories: [],
      })
    ).toBe(false)
  })

  it('falls back to name Savings when isSavings omitted', () => {
    expect(
      isSavingsPlanCategory({
        id: '3',
        name: '  savings ',
        icon: '💰',
        amount: 50,
        subcategories: [],
      })
    ).toBe(true)
  })
})

describe('plan totals', () => {
  const rates = {}

  it('excludes savings row from planned expenses', () => {
    const plan = basePlan([
      {
        id: 'a',
        name: 'Rent',
        icon: '🏠',
        amount: 5000,
        subcategories: [],
      },
      {
        id: 'b',
        name: 'Savings',
        icon: '💰',
        amount: 2000,
        isSavings: true,
        subcategories: [],
      },
    ])
    expect(totalPlannedExpensesForPlan(plan, 'AED', rates)).toBe(5000)
    expect(totalPlannedSavingsAllocationForPlan(plan, 'AED', rates)).toBe(2000)
  })
})
