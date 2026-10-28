import { describe, expect, it } from 'vitest'
import type { BudgetPlan } from '@/lib/store/types'
import {
  isSavingsPlanCategory,
  uniquePlanCategoryName,
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

  it('lets an explicit isSavings false win over the grow block', () => {
    const c = { id: 'g', name: 'Giving', icon: 'x', amount: 10, block: 'grow' as const, subcategories: [] }
    expect(isSavingsPlanCategory(c)).toBe(true)
    expect(isSavingsPlanCategory({ ...c, isSavings: false })).toBe(false)
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

describe('uniquePlanCategoryName', () => {
  const rows = [{ name: 'Category' }, { name: 'category 2' }] as BudgetPlan['categories']
  it('keeps a free name and numbers a taken one, ignoring case', () => {
    expect(uniquePlanCategoryName(rows, 'Food')).toBe('Food')
    expect(uniquePlanCategoryName(rows, ' CATEGORY ')).toBe('CATEGORY 3')
  })
})
