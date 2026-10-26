import { describe, expect, it } from 'vitest'
import type { Expense, Goal } from '@/lib/store/types'
import { computeGoalProgress, type GoalProgressContext } from './computeGoalProgress'

const exp = (category: Expense['category'], amount: number) =>
  ({ id: category + amount, category, amount, currency: 'EGP', amountInBaseCurrency: amount, date: '2026-10-05' }) as unknown as Expense
const ctx = (expenses: Expense[]): GoalProgressContext => ({
  savingsAccounts: [], debts: [], debtPayments: [], expenses, exchangeRates: { EGP: 1 },
  goldPricePerGram: 0, goldPriceAvailable: false, monthFilter: '2026-10', monthStartDay: 1, baseCurrency: 'EGP',
})
const goal = (over: Partial<Goal>): Goal => ({
  id: 'g', name: 'Limit', emoji: '📉', category: 'spending_control', targetAmount: null, currency: 'EGP',
  manualCurrentAmount: 0, targetDate: null, linkedSavingsAccountIds: [], linkedDebtIds: [],
  monthlySpendingLimit: 1000, priority: 0, status: 'active', monthlyContribution: null,
  fundingMode: 'manual', sharePct: null, frequency: 'monthly', planStart: null,
  notes: null, createdAt: '2026-01-01', achievedAt: null, ...over,
})

describe('spending_control progress', () => {
  const expenses = [exp('Food', 300), exp('Transport', 200)]
  it('counts all spending when no category is set', () => {
    expect(computeGoalProgress(goal({}), ctx(expenses))).toBe(500)
  })
  it('counts only the chosen category', () => {
    expect(computeGoalProgress(goal({ spendingCategory: 'Food' }), ctx(expenses))).toBe(300)
  })
})

describe('spending_control excludes money movements', () => {
  it('ignores Savings and CC Payoff rows', () => {
    const rows = [exp('Food', 100), exp('Savings', 500), exp('CC Payoff', 300)]
    expect(computeGoalProgress(goal({}), ctx(rows))).toBe(100)
  })
})

describe('savings-linked progress', () => {
  it('values an XAU pocket at the gold price, not grams as money', () => {
    const gold = { id: 's1', currency: 'XAU', currentBalance: 40 } as never
    const c = { ...ctx([]), savingsAccounts: [gold], goldPricePerGram: 6000, goldPriceAvailable: true }
    const g = goal({ category: 'emergency_fund', linkedSavingsAccountIds: ['s1'] })
    expect(computeGoalProgress(g, c)).toBe(240_000)
  })
  it('leaves an unpriceable gold pocket out when the gold price is unavailable', () => {
    const gold = { id: 's1', currency: 'XAU', currentBalance: 40 } as never
    const g = goal({ category: 'emergency_fund', linkedSavingsAccountIds: ['s1'] })
    expect(computeGoalProgress(g, { ...ctx([]), savingsAccounts: [gold] })).toBe(0)
  })
})
