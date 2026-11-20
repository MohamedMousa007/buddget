import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

// S-3, S-4, S-5: a row brought back by Undo must be newer than its delete (0319), so it carries a fresh edit time.
const OLD = '2026-11-01T10:00:00.000Z'
const NOW = Date.UTC(2026, 10, 20, 12)

describe('Undo restores with fresh edit times', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
  afterEach(() => vi.useRealTimers())

  it('S-3: a pocket-funded debt payment Undo re-takes the withdrawal and restores the schedule with a fresh stamp', () => {
    useFinanceStore.setState({
      debts: [{ id: 'd1', name: 'Loan', currentBalance: 500, currency: 'EGP' }] as never,
      debtPayments: [],
      savingsAccounts: [{ id: 'p1', name: 'Pocket', currentBalance: 1000, currency: 'EGP' }] as never,
      savingsTransactions: [],
      recurringDebtPayments: [{ id: 'r1', debtId: 'd1', amount: 100, updatedAt: '2026-11-19T00:00:00.000Z' }] as never,
      expenses: [],
    })
    const ok = useFinanceStore.getState().restoreDebtPayment({
      payment: { id: 'dp1', debtId: 'd1', amount: 100, currency: 'EGP', date: '2026-11-01', updatedAt: OLD } as never,
      expenses: [],
      debtWasCleared: false,
      savingsTx: { id: 'st1', accountId: 'p1', amount: 100, type: 'withdrawal', currency: 'EGP', date: '2026-11-01', updatedAt: OLD } as never,
      schedule: { id: 'r1', debtId: 'd1', amount: 100, updatedAt: OLD } as never,
    })
    expect(ok).toBe(true)
    const s = useFinanceStore.getState()
    expect(Date.parse(s.savingsTransactions.find((t) => t.id === 'st1')!.updatedAt!)).toBe(NOW)
    expect(Date.parse((s.recurringDebtPayments.find((r) => r.id === 'r1') as { updatedAt?: string }).updatedAt!)).toBe(NOW)
  })

  it('S-4: an activation brought back by Undo gets a fresh stamp; one still live keeps its own', () => {
    const kept = { id: 'a1', planId: 'p1', effectiveFrom: '2026-10-01', createdAt: OLD, updatedAt: OLD }
    const gone = { id: 'a2', planId: 'p2', effectiveFrom: '2026-11-01', createdAt: OLD, updatedAt: OLD }
    useFinanceStore.setState({ budgetPlanActivations: [kept] as never })
    useFinanceStore.getState().restoreBudgetActivation({ activeBudgetPlanId: 'p2', activations: [kept, gone] as never })
    const acts = useFinanceStore.getState().budgetPlanActivations as Array<{ id: string; updatedAt?: string }>
    expect(acts.find((a) => a.id === 'a1')!.updatedAt).toBe(OLD)
    expect(Date.parse(acts.find((a) => a.id === 'a2')!.updatedAt!)).toBe(NOW)
  })
})
