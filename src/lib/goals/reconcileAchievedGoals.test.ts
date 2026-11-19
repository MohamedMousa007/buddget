import { describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { applyDelta } from '@/lib/supabase/remote/delta'
import { snapshot } from '@/lib/supabase/remote'
import type { Goal } from '@/lib/store/types'

const OLD = '2026-11-01T00:00:00.000Z'
const goal = { id: 'g1', name: 'Trip', category: 'custom', status: 'active', updatedAt: OLD, createdAt: OLD } as unknown as Goal
const none = { upserts: [], deletedIds: [] }

describe('QA-20: a goal that becomes achieved carries a new edit time', () => {
  it('achieveGoal stamps the goal, so it survives a pull that still holds the active server copy', () => {
    useFinanceStore.setState({ goals: [goal] })
    const delivered = snapshot(useFinanceStore.getState())
    useFinanceStore.getState().achieveGoal('g1')
    const local = snapshot(useFinanceStore.getState())
    expect(Date.parse(local.goals[0].updatedAt!)).toBeGreaterThan(Date.parse(OLD))
    // The server read happened before the "achieved" flush committed: same row, old edit time, still active.
    const delta = {
      cursor: 'c', profile: null, settings: null, paymentMethods: none, incomeSources: none, incomeEvents: none, expenses: none, receipts: none,
      recurringExpenses: none, subscriptions: none, debts: none, debtPayments: none, recurringDebtPayments: none, savingsAccounts: none,
      investmentHoldings: none, savingsTransactions: none, recurringSavingsDeposits: none, goals: { upserts: [goal], deletedIds: [] },
      buddgyMemories: none, accountAdjustments: none, budgetPlans: [], deletedBudgetPlanIds: [], budgetPlanActivations: [], deletedBudgetPlanActivationIds: [], staleBefore: null,
    }
    expect(applyDelta(local, delta as never, delivered).goals[0].status).toBe('achieved')
  })
})
