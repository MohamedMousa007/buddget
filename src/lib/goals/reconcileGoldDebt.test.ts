import { describe, it, expect } from 'vitest'
import type { Debt, DebtPayment, Goal } from '@/lib/store/types'
import type { GoalProgressContext } from '@/lib/goals/computeGoalProgress'
import { reconcileAchievedGoals } from '@/lib/goals/reconcileAchievedGoals'

const debt = (o: Partial<Debt>): Debt => ({ id: 'd', name: 'x', person: 'p', startingBalance: 100, currency: 'EGP', isGold: false, createdAt: '2026-01-01', debtType: 'personal', status: 'active', ...o } as Debt)
const goal = { id: 'g', name: 'Free', emoji: '', category: 'debt_freedom', targetAmount: 1, currency: 'EGP', manualCurrentAmount: 0, targetDate: null, linkedSavingsAccountIds: [], linkedDebtIds: ['cash', 'gold'], monthlySpendingLimit: null, priority: 0, status: 'active', monthlyContribution: null, fundingMode: 'manual', sharePct: null, frequency: 'monthly', planStart: null, notes: null, createdAt: '2026-01-01', achievedAt: null } as Goal
const ctx = (goldPriceAvailable: boolean): GoalProgressContext => ({
  savingsAccounts: [], expenses: [], exchangeRates: { USD_EGP: 50 }, goldPricePerGram: goldPriceAvailable ? 3000 : 0, goldPriceAvailable, monthFilter: '2026-11', monthStartDay: 1, baseCurrency: 'EGP',
  debts: [debt({ id: 'cash' }), debt({ id: 'gold', isGold: true, currency: 'XAU', startingBalance: 10, goldKarat: 24, receivedVia: 'gold' })],
  debtPayments: [{ id: 'p', debtId: 'cash', date: '2026-11-01', amountPaid: 100 } as DebtPayment],
})

describe('a debt-freedom goal is not achieved while a gold debt is still owed', () => {
  it('gold priced: stays active', () => {
    expect(reconcileAchievedGoals([goal], ctx(true)).goals[0].status).toBe('active')
  })
  it('gold unpriced: stays active (10 g still owed)', () => {
    expect(reconcileAchievedGoals([goal], ctx(false)).goals[0].status).toBe('active')
  })
})
