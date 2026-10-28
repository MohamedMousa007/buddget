import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { planForMonth } from '@/lib/budget/activations'
import type { BudgetPlan } from '@/lib/store/types'

const plan = (id: string, createdAt: string): BudgetPlan => ({ id, name: id, categories: [], createdAt, status: 'ready' })

describe('activateBudgetPlan', () => {
  beforeEach(() => {
    useFinanceStore.setState({
      budgetPlans: [plan('old', '2026-07-10T00:00:00Z'), plan('new', '2026-10-01T00:00:00Z')],
      budgetPlanActivations: [],
      activeBudgetPlanId: 'old',
    })
  })

  it('keeps earlier months with the plan that was active, and the new plan from the cycle on', () => {
    useFinanceStore.getState().activateBudgetPlan('new', '2026-10')
    const s = useFinanceStore.getState()
    expect(s.activeBudgetPlanId).toBe('new')
    expect(planForMonth(s.budgetPlans, s.budgetPlanActivations, '2026-08', s.activeBudgetPlanId)?.id).toBe('old')
    expect(planForMonth(s.budgetPlans, s.budgetPlanActivations, '2026-10', s.activeBudgetPlanId)?.id).toBe('new')
    expect(planForMonth(s.budgetPlans, s.budgetPlanActivations, '2027-03', s.activeBudgetPlanId)?.id).toBe('new')
  })

  it('undo restores the active plan and the log', () => {
    const undo = useFinanceStore.getState().activateBudgetPlan('new', '2026-10')
    useFinanceStore.getState().restoreBudgetActivation(undo)
    const s = useFinanceStore.getState()
    expect(s.activeBudgetPlanId).toBe('old')
    expect(s.budgetPlanActivations).toEqual([])
  })

  it('a second switch in the same cycle replaces the first', () => {
    const st = useFinanceStore.getState()
    st.activateBudgetPlan('new', '2026-10')
    st.activateBudgetPlan('old', '2026-10')
    const s = useFinanceStore.getState()
    expect(s.budgetPlanActivations.filter((a) => a.effectiveFrom === '2026-10-01')).toEqual([])
    expect(planForMonth(s.budgetPlans, s.budgetPlanActivations, '2026-10', s.activeBudgetPlanId)?.id).toBe('old')
  })

  it('an old plan created in the switch month still covers the months before it', () => {
    useFinanceStore.setState({ budgetPlans: [plan('old', '2026-10-05T00:00:00Z'), plan('new', '2026-10-06T00:00:00Z')] })
    useFinanceStore.getState().activateBudgetPlan('new', '2026-10')
    const s = useFinanceStore.getState()
    expect(planForMonth(s.budgetPlans, s.budgetPlanActivations, '2026-09', s.activeBudgetPlanId)?.id).toBe('old')
    expect(planForMonth(s.budgetPlans, s.budgetPlanActivations, '2026-10', s.activeBudgetPlanId)?.id).toBe('new')
  })
})

describe('deleteBudgetPlan', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-19T09:00:00Z'))
    useFinanceStore.setState({
      budgetPlans: [plan('third', '2026-10-02T00:00:00Z'), plan('old', '2026-07-10T00:00:00Z'), plan('new', '2026-10-01T00:00:00Z')],
      budgetPlanActivations: [],
      activeBudgetPlanId: 'old',
    })
    useFinanceStore.getState().activateBudgetPlan('new', '2026-10')
  })
  afterEach(() => vi.useRealTimers())

  it('hands the current cycle to the fallback plan when the active plan is deleted', () => {
    useFinanceStore.getState().deleteBudgetPlan('new')
    const s = useFinanceStore.getState()
    expect(s.activeBudgetPlanId).toBe('third')
    expect(planForMonth(s.budgetPlans, s.budgetPlanActivations, '2026-10', s.activeBudgetPlanId)?.id).toBe('third')
    expect(planForMonth(s.budgetPlans, s.budgetPlanActivations, '2026-08', s.activeBudgetPlanId)?.id).toBe('old')
    expect(s.budgetPlanActivations.every((a) => a.planId !== 'new')).toBe(true)
  })

  it('only drops the activations of a plan that was not active', () => {
    useFinanceStore.getState().deleteBudgetPlan('old')
    const s = useFinanceStore.getState()
    expect(s.activeBudgetPlanId).toBe('new')
    expect(s.budgetPlanActivations.map((a) => a.planId)).toEqual(['new'])
  })
})
