import { describe, expect, it, vi } from 'vitest'
import { answer, createFlow } from '@/lib/budget/flow/flow'
import { commitFlowEntities, createdIds, type StudioEntityNames } from '@/lib/budget/studioEntities'
import type { FlowValue } from '@/lib/budget/flow/types'

const names: StudioEntityNames = { income: 'Salary', savings: 'Savings', debt: (id) => `debt:${id}`, goal: (k) => `goal:${k}` }
const NOW = new Date(2026, 9, 19)

function fakeStore(held: { incomeSources?: unknown[]; debts?: unknown[]; savingsAccounts?: unknown[]; goals?: { priority: number }[] } = {}) {
  let n = 0
  return {
    goals: held.goals ?? ([] as { priority: number }[]),
    incomeSources: held.incomeSources ?? [],
    debts: held.debts ?? [],
    savingsAccounts: held.savingsAccounts ?? [],
    addIncomeSource: vi.fn(),
    addSavingsAccount: vi.fn(() => 'pocket-1'),
    addDebt: vi.fn(() => `debt-${++n}`),
    addGoal: vi.fn(() => `goal-${++n}`),
  }
}

const answered = (a: Record<string, FlowValue>) => Object.entries(a).reduce((s, [k, v]) => answer(s, k, v), createFlow('mixed'))

describe('commitFlowEntities', () => {
  it('creates nothing for an empty run', () => {
    const store = fakeStore()
    expect(commitFlowEntities(createFlow('mixed'), store as never, 'EGP', names, NOW)).toEqual({})
    expect(store.addDebt).not.toHaveBeenCalled()
  })

  it('creates income, savings, one debt per kind and a goal from the answers', () => {
    const store = fakeStore()
    const s = answered({
      income: 20000, incomeType: 'freelance', payday: 27, savingsOnHand: 15000, debtKinds: ['loan', 'family'], loanBalance: 9000, loanMin: 450, loanApr: 'over25',
      familyOwed: 3000, familyMonthly: 0, goalKind: 'car', goalTarget: 120000, goalTiming: 'by_date', goalMonths: 24,
    })
    const created = commitFlowEntities(s, store as never, 'EGP', names, NOW)
    expect(Object.keys(created).sort()).toEqual(['debt:answered-family', 'debt:answered-loan', 'goal:answered-goal-1', 'income', 'savings'])
    expect(store.addIncomeSource).toHaveBeenCalledWith(expect.objectContaining({ amount: 20000, paydayDays: [27], sourceType: 'side_hustle' }))
    expect(store.addSavingsAccount).toHaveBeenCalledWith(expect.objectContaining({ openingBalance: 15000, isEmergencyCover: true }))
    expect(store.addDebt).toHaveBeenCalledWith(expect.objectContaining({ name: 'debt:answered-loan', startingBalance: 9000, installmentAmount: 450, installmentCount: 20, interestFree: false }))
    expect(store.addDebt).toHaveBeenCalledWith(expect.objectContaining({ name: 'debt:answered-family', startingBalance: 3000, installmentAmount: 250, installmentCount: 12, interestFree: true }))
    expect(store.addGoal).toHaveBeenCalledWith(expect.objectContaining({ name: 'goal:car', category: 'car', targetAmount: 120000, monthlyContribution: 5000, targetDate: '2028-10-19' }))
  })

  it('a weekly or biweekly payer gets a source of that frequency, per-paycheck amount and derived paydays (BUD4)', () => {
    const weekly = fakeStore()
    commitFlowEntities(answered({ income: 20000, incomeType: 'salary', payFrequency: 'weekly' }), weekly as never, 'EGP', names, NOW)
    expect(weekly.addIncomeSource).toHaveBeenCalledWith(expect.objectContaining({ recurringFrequency: 'weekly', amount: 5000, paydayDays: [4, 11, 18, 25] }))
    const biweekly = fakeStore()
    commitFlowEntities(answered({ income: 20000, incomeType: 'salary', payFrequency: 'biweekly' }), biweekly as never, 'EGP', names, NOW)
    expect(biweekly.addIncomeSource).toHaveBeenCalledWith(expect.objectContaining({ recurringFrequency: 'biweekly', amount: 10000, paydayDays: [10, 25] }))
    const monthly = fakeStore()
    commitFlowEntities(answered({ income: 20000, incomeType: 'salary', payFrequency: 'monthly', payday: 3 }), monthly as never, 'EGP', names, NOW)
    expect(monthly.addIncomeSource).toHaveBeenCalledWith(expect.objectContaining({ recurringFrequency: 'monthly', amount: 20000, paydayDays: [3] }))
  })

  it('never creates a record twice when the build is retried or resumed', () => {
    const store = fakeStore()
    const s = answered({ income: 20000, debtKinds: ['loan'], loanBalance: 900, loanMin: 100 })
    const first = commitFlowEntities(s, store as never, 'EGP', names, NOW)
    commitFlowEntities({ ...s, entities: first }, store as never, 'EGP', names, NOW)
    expect(store.addIncomeSource).toHaveBeenCalledTimes(1)
    expect(store.addDebt).toHaveBeenCalledTimes(1)
  })

  it('a card paid in full, or a debt with no balance, creates no debt', () => {
    const store = fakeStore()
    commitFlowEntities(answered({ debtKinds: ['card'], cardPayFull: true }), store as never, 'EGP', names, NOW)
    commitFlowEntities(answered({ debtKinds: ['bnpl'], bnplMonthly: 0 }), store as never, 'EGP', names, NOW)
    expect(store.addDebt).not.toHaveBeenCalled()
  })

  it('reports which debts and goals it created, so the plan uses the richer answered facts instead of counting both', () => {
    expect(createdIds({ income: 'done', savings: 'pocket-1', 'debt:answered-loan': 'debt-1', 'goal:answered-goal-1': 'goal-2' })).toEqual(new Set(['debt-1', 'goal-2']))
  })

  it('creates nothing the app already holds, so a described income or debt cannot double a real one', () => {
    const store = fakeStore({ incomeSources: [{}], debts: [{}], savingsAccounts: [{}], goals: [{ priority: 0 }] })
    const s = answered({ income: 20000, savingsOnHand: 5000, debtKinds: ['loan'], loanBalance: 900, loanMin: 100, goalTarget: 1200, goalTiming: 'by_date', goalMonths: 12 })
    expect(commitFlowEntities(s, store as never, 'EGP', names, NOW)).toEqual({})
    expect(store.addIncomeSource).not.toHaveBeenCalled()
    expect(store.addDebt).not.toHaveBeenCalled()
    expect(store.addGoal).not.toHaveBeenCalled()
    expect(store.addSavingsAccount).not.toHaveBeenCalled()
  })
})
