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
  fundingMode: 'manual', sharePct: null, frequency: 'monthly',
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
