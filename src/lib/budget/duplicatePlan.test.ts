import { describe, expect, it } from 'vitest'
import { duplicatePlanCategories, duplicatePlanExtras } from '@/lib/budget/duplicatePlan'
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

  it('carries the income override, household and rationale so the copy shows the same free money', () => {
    const rationale = { summary: 'x' } as unknown as BudgetPlan['rationale']
    const plan = { id: 'p', name: 'P', createdAt: '', categories: [], incomeOverride: 9000, household: 'family', rationale } as BudgetPlan
    expect(duplicatePlanExtras(plan)).toEqual({ incomeOverride: 9000, household: 'family', rationale })
  })
})
