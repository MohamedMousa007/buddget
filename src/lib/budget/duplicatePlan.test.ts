import { describe, expect, it } from 'vitest'
import { duplicatePlanCategories } from '@/lib/budget/duplicatePlan'
import type { BudgetPlan } from '@/lib/store/types'

describe('duplicatePlanCategories', () => {
  it('copies lines with new ids and no shared arrays', () => {
    let n = 0
    const plan: BudgetPlan = {
      id: 'p', name: 'P', createdAt: '',
      categories: [{ id: 'a', name: 'Card', icon: 'credit-card', amount: 5, subcategories: [{ id: 's', name: 'x', amount: 1 }], block: 'debts', linkType: 'debts', linkIds: ['d1'], expenseCategories: ['Debt'] }],
    }
    const copy = duplicatePlanCategories(plan, () => `n${++n}`)
    expect(copy[0]).toMatchObject({ id: 'n1', name: 'Card', block: 'debts', linkIds: ['d1'], subcategories: [{ id: 'n2', name: 'x' }] })
    expect(copy[0].linkIds).not.toBe(plan.categories[0].linkIds)
    expect(plan.categories[0].id).toBe('a')
  })
})
