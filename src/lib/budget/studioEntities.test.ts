import { describe, expect, it, vi } from 'vitest'
import { applyAnswer, createState, mergeFacts, type StudioState } from '@/lib/budget/infoGaps'
import { commitStudioEntities, type StudioEntityNames } from '@/lib/budget/studioEntities'
import type { BudgetFacts } from '@/lib/budget/facts'

const names: StudioEntityNames = { income: 'Salary', debt: 'My debts', savings: 'Savings', goal: (k) => `goal:${k}` }
const NOW = new Date(2026, 9, 19)

function fakeStore(held: { incomeSources?: unknown[]; debts?: unknown[]; savingsAccounts?: unknown[]; goals?: { priority: number }[] } = {}) {
  return {
    goals: held.goals ?? ([] as { priority: number }[]),
    incomeSources: held.incomeSources ?? [],
    debts: held.debts ?? [],
    savingsAccounts: held.savingsAccounts ?? [],
    addIncomeSource: vi.fn(),
    addSavingsAccount: vi.fn(() => 'pocket-1'),
    addDebt: vi.fn(() => 'debt-1'),
    addGoal: vi.fn(() => 'goal-1'),
  }
}

const answered = (a: Record<string, unknown>): StudioState =>
  Object.entries(a).reduce((s, [k, v]) => applyAnswer(s, k, v), createState())

describe('commitStudioEntities', () => {
  it('creates nothing for an empty run', () => {
    const store = fakeStore()
    expect(commitStudioEntities(createState(), store as never, 'EGP', names, NOW)).toEqual({})
    expect(store.addDebt).not.toHaveBeenCalled()
  })

  it('creates income, savings, an amount-only debt and a goal from the answers', () => {
    const store = fakeStore()
    const s = answered({
      income: 20000, payday: 27, savingsOnHand: 15000, hasDebts: true, debtTotal: 9000, debtMonthly: 450,
      hasGoal: true, goalKind: 'car', goalTarget: 120000, goalMonths: 24,
    })
    const created = commitStudioEntities(s, store as never, 'EGP', names, NOW)
    expect(created).toEqual({ income: 'done', savings: 'pocket-1', debt: 'debt-1', goal: 'goal-1' })
    expect(store.addIncomeSource).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 20000, currency: 'EGP', paydayDays: [27], dayOfMonth: 27, isRecurring: true, sourceType: 'salary' }),
    )
    expect(store.addSavingsAccount).toHaveBeenCalledWith(expect.objectContaining({ openingBalance: 15000, isEmergencyCover: true, category: 'savings' }))
    expect(store.addDebt).toHaveBeenCalledWith(
      expect.objectContaining({ startingBalance: 9000, installmentAmount: 450, installmentCount: 20, debtType: 'installment', interestFree: true, direction: 'i_owe' }),
    )
    expect(store.addGoal).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'goal:car', category: 'car', targetAmount: 120000, monthlyContribution: 5000, fundingMode: 'fixed', targetDate: '2028-10-19' }),
    )
  })

  it('never creates a record twice when the build is retried or resumed', () => {
    const store = fakeStore()
    const s = answered({ income: 20000, hasDebts: true, debtTotal: 900, debtMonthly: 100 })
    const first = commitStudioEntities(s, store as never, 'EGP', names, NOW)
    commitStudioEntities({ ...s, entities: first }, store as never, 'EGP', names, NOW)
    expect(store.addIncomeSource).toHaveBeenCalledTimes(1)
    expect(store.addDebt).toHaveBeenCalledTimes(1)
  })

  it('a "no" to debts creates no debt, and a debt with only a payment still gets one', () => {
    const store = fakeStore()
    commitStudioEntities(answered({ hasDebts: false, debtTotal: 500 }), store as never, 'EGP', names, NOW)
    expect(store.addDebt).not.toHaveBeenCalled()
    commitStudioEntities(answered({ hasDebts: true, debtMonthly: 300 }), store as never, 'EGP', names, NOW)
    expect(store.addDebt).toHaveBeenCalledWith(expect.objectContaining({ startingBalance: 300, installmentAmount: 300, installmentCount: 1 }))
  })

  it('once created, the stand-in debt and goal leave the facts so nothing is counted twice', () => {
    const base = { debts: [], goals: [] } as unknown as BudgetFacts
    const s = answered({ hasDebts: true, debtTotal: 900, debtMonthly: 100, hasGoal: true, goalTarget: 1200, goalMonths: 12 })
    expect(mergeFacts(base, s).debts).toHaveLength(1)
    const done = { ...s, entities: { debt: 'debt-1', goal: 'goal-1' } }
    expect(mergeFacts(base, done).debts).toHaveLength(0)
    expect(mergeFacts(base, done).goals).toHaveLength(0)
  })

  it('creates nothing the app already holds, so a described income or debt cannot double a real one', () => {
    const store = fakeStore({ incomeSources: [{}], debts: [{}], savingsAccounts: [{}], goals: [{ priority: 0 }] })
    const s = answered({ income: 20000, savingsOnHand: 5000, hasDebts: true, debtTotal: 900, debtMonthly: 100, hasGoal: true, goalTarget: 1200, goalMonths: 12 })
    expect(commitStudioEntities(s, store as never, 'EGP', names, NOW)).toEqual({})
    expect(store.addIncomeSource).not.toHaveBeenCalled()
    expect(store.addDebt).not.toHaveBeenCalled()
    expect(store.addGoal).not.toHaveBeenCalled()
    expect(store.addSavingsAccount).not.toHaveBeenCalled()
  })
})

