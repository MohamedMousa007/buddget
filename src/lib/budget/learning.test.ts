import { describe, expect, it } from 'vitest'
import { isLearning } from '@/lib/budget/learning'
import type { BudgetPlan, BudgetPlanActivation } from '@/lib/store/types'

const plan = (lines: Array<[number, 'high' | 'estimated' | null]>): BudgetPlan =>
  ({ id: 'p', categories: lines.map(([amount, confidence], i) => ({ id: String(i), amount, confidence })) }) as unknown as BudgetPlan
const act = (effectiveFrom: string, planId = 'p'): BudgetPlanActivation => ({ id: 'a', planId, effectiveFrom, createdAt: '' })

describe('isLearning', () => {
  it('is on in the first cycle when enough of the money is estimated', () => {
    expect(isLearning(plan([[700, 'high'], [300, 'estimated']]), [act('2026-10-01')], '2026-10')).toBe(true)
  })
  it('is off once the first cycle has passed', () => {
    expect(isLearning(plan([[100, 'estimated']]), [act('2026-10-01')], '2026-11')).toBe(false)
  })
  it('is off when the plan is mostly the user\'s own numbers', () => {
    expect(isLearning(plan([[900, 'high'], [100, 'estimated']]), [act('2026-10-01')], '2026-10')).toBe(false)
  })
  it('is off for a plan that was never activated, or has no money', () => {
    expect(isLearning(plan([[100, 'estimated']]), [], '2026-10')).toBe(false)
    expect(isLearning(plan([[0, 'estimated']]), [act('2026-10-01')], '2026-10')).toBe(false)
  })
  it('uses the first activation, so reactivating later does not restart the clock', () => {
    expect(isLearning(plan([[100, 'estimated']]), [act('2026-11-01'), act('2026-09-01')], '2026-11')).toBe(false)
  })
})
