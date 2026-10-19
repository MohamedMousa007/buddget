import { describe, expect, it } from 'vitest'
import { comparePlans } from '@/lib/budget/comparePlans'
import type { BudgetPlan, BudgetPlanCategory } from '@/lib/store/types'

const line = (o: Partial<BudgetPlanCategory> & { id: string; name: string; amount: number }): BudgetPlanCategory => ({ icon: 'wallet', subcategories: [], currency: 'AED', block: 'everyday', ...o })
const A: BudgetPlan = { id: 'a', name: 'A', createdAt: '', categories: [line({ id: '1', name: 'Groceries', amount: 2000 }), line({ id: '2', name: 'Rent', amount: 5000, block: 'bills' }), line({ id: '3', name: 'Gym', amount: 150 })] }
const B: BudgetPlan = { id: 'b', name: 'B', createdAt: '', categories: [line({ id: '9', name: 'groceries', amount: 1800 }), line({ id: '8', name: 'Rent', amount: 5000, block: 'bills' }), line({ id: '7', name: 'Extra payoff', amount: 600, block: 'debts' })] }

describe('comparePlans', () => {
  const c = comparePlans(A, B, 'AED', {})
  it('totals and block deltas', () => {
    expect(c.totalA).toBe(7150)
    expect(c.totalB).toBe(7400)
    expect(c.blocks.find((x) => x.block === 'everyday')).toEqual({ block: 'everyday', a: 2150, b: 1800, delta: -350 })
    expect(c.blocks.find((x) => x.block === 'debts')).toEqual({ block: 'debts', a: 0, b: 600, delta: 600 })
  })
  it('matches lines by block and case-insensitive name, skips unchanged, sorts by size', () => {
    expect(c.lines.map((l) => [l.name, l.a, l.b, l.delta])).toEqual([
      ['Extra payoff', null, 600, 600],
      ['Groceries', 2000, 1800, -200],
      ['Gym', 150, null, -150],
    ])
  })
})
