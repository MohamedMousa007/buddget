import { describe, expect, it } from 'vitest'
import { summarizePlan } from '@/lib/budget/planSummary'
import type { BudgetPlan, BudgetPlanCategory } from '@/lib/store/types'

const line = (over: Partial<BudgetPlanCategory> & { id: string; name: string; amount: number }): BudgetPlanCategory => ({
  icon: 'wallet', subcategories: [], currency: 'AED', ...over,
})
const plan: BudgetPlan = {
  id: 'p', name: 'P', createdAt: '', categories: [
    line({ id: '1', name: 'Rent', amount: 4000, block: 'bills' }),
    line({ id: '2', name: 'Card', amount: 500, block: 'debts', linkType: 'debts', linkIds: ['d'] }),
    line({ id: '3', name: 'Extra payoff', amount: 600, block: 'debts', linkType: 'none' }),
    line({ id: '4', name: 'Food', amount: 2000, block: 'everyday' }),
    line({ id: '5', name: 'Safety net', amount: 1000, block: 'safety', linkType: 'emergency' }),
    line({ id: '6', name: 'Invest', amount: 900, block: 'grow', isSavings: true }),
  ],
}

describe('summarizePlan', () => {
  const s = summarizePlan(plan, 10000, 'AED', {})
  it('totals, free and counts', () => {
    expect(s.total).toBe(9000)
    expect(s.free).toBe(1000)
    expect(s.lineCount).toBe(6)
  })
  it('savings rate counts every savings movement', () => {
    expect(s.savingsRate).toBeCloseTo(19, 5)
  })
  it('extra payoff is the unlinked debt money only', () => {
    expect(s.extraPayoff).toBe(600)
    expect(s.everyday).toBe(2000)
  })
  it('flow lists every block in page order as shares of income', () => {
    expect(s.flow.map((f) => f.block)).toEqual(['bills', 'subscriptions', 'debts', 'everyday', 'safety', 'goals', 'grow'])
    expect(s.flow[0].percent).toBeCloseTo(40, 5)
  })
  it('is all zero for an empty plan without income', () => {
    const e = summarizePlan({ ...plan, categories: [] }, 0, 'AED', {})
    expect(e.savingsRate).toBe(0)
    expect(e.total).toBe(0)
  })
})
