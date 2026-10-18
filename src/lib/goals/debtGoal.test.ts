import { describe, it, expect } from 'vitest'
import type { Debt, DebtPayment, Goal } from '@/lib/store/types'
import type { GoalProgressContext } from './computeGoalProgress'
import { computeGoalProgress } from './computeGoalProgress'
import { debtEndDate, debtGoalTotals, trackedDebtIds, withDebtDerived } from './debtGoal'
import { convertCurrency } from '@/lib/utils/currency'
import { reconcileAchievedGoals } from './reconcileAchievedGoals'

const debt = (o: Partial<Debt> = {}): Debt => ({
  id: 'd1', name: 'Car installment', person: 'Bank', startingBalance: 120000, currency: 'EGP', isGold: false,
  createdAt: '2026-01-01', debtType: 'installment', installmentCount: 12, installmentFrequency: 'monthly',
  installmentAmount: 10000, startDate: '2026-01-15', ...o,
} as Debt)
const pay = (debtId: string, amountPaid: number, id = Math.random().toString()): DebtPayment =>
  ({ id, debtId, date: '2026-03-01', amountPaid }) as DebtPayment
const goal = (o: Partial<Goal> = {}): Goal => ({
  id: 'g', name: 'Car', emoji: '', category: 'debt_freedom', targetAmount: 999, currency: 'EGP', manualCurrentAmount: 0,
  targetDate: null, linkedSavingsAccountIds: [], linkedDebtIds: ['d1'], monthlySpendingLimit: null, priority: 0,
  status: 'active', monthlyContribution: null, fundingMode: 'manual', sharePct: null, frequency: 'monthly',
  planStart: null, notes: null, createdAt: '2026-01-01', achievedAt: null, ...o,
})
const ctx = (debts: Debt[], debtPayments: DebtPayment[]): GoalProgressContext => ({
  savingsAccounts: [], debts, debtPayments, expenses: [], exchangeRates: { EGP: 1, USD: 50 }, goldPricePerGram: 0,
  goldPriceAvailable: false, monthFilter: '2026-10', monthStartDay: 1, baseCurrency: 'EGP',
})

describe('debt goals follow their debt', () => {
  it('derives target from the debt, not from a stored number', () => {
    const c = ctx([debt()], [pay('d1', 30000)])
    expect(debtGoalTotals(goal(), c)).toEqual({ paid: 30000, total: 120000 })
    const g = withDebtDerived(goal(), c)
    expect(g.targetAmount).toBe(120000)
    expect(computeGoalProgress(goal(), c)).toBe(30000)
  })
  it('stays in sync when the debt grows or is paid', () => {
    expect(withDebtDerived(goal(), ctx([debt({ startingBalance: 150000 })], [pay('d1', 30000)])).targetAmount).toBe(150000)
    expect(withDebtDerived(goal(), ctx([debt()], [pay('d1', 30000), pay('d1', 10000)])).targetAmount).toBe(120000)
  })
  it('finish date comes from the installment schedule', () => {
    expect(debtEndDate(debt())).toBe('2026-12-15')
    expect(withDebtDerived(goal(), ctx([debt()], [])).targetDate).toBe('2026-12-15')
    expect(debtEndDate(debt({ installmentCount: undefined, startDate: undefined, goal: { targetDate: '2028-05-01', paymentFrequency: 'monthly', calculatedAmount: 1 } }))).toBe('2028-05-01')
  })
  it('sums several debts in the goal currency', () => {
    const c = ctx([debt(), debt({ id: 'd2', startingBalance: 1000, currency: 'USD' })], [pay('d2', 400)])
    const usd = (n: number) => convertCurrency(n, 'USD', 'EGP', c.exchangeRates)
    const t = debtGoalTotals(goal({ linkedDebtIds: ['d1', 'd2'] }), c)!
    expect(t.paid).toBeCloseTo(usd(400))
    expect(t.total).toBeCloseTo(120000 + usd(1000))
    expect(usd(1000)).toBeGreaterThan(1000)
  })
  it('falls back to stored figures when nothing is linked', () => {
    expect(debtGoalTotals(goal({ linkedDebtIds: [] }), ctx([debt()], []))).toBeNull()
    expect(withDebtDerived(goal({ linkedDebtIds: [] }), ctx([debt()], [])).targetAmount).toBe(999)
  })
  it('completes when the debt is fully paid or cleared', () => {
    const full = reconcileAchievedGoals([goal()], ctx([debt()], [pay('d1', 120000)]))
    expect(full.newlyAchievedIds).toEqual(['g'])
    const cleared = reconcileAchievedGoals([goal()], ctx([debt({ status: 'cleared' })], [pay('d1', 120000)]))
    expect(cleared.newlyAchievedIds).toEqual(['g'])
    expect(reconcileAchievedGoals([goal()], ctx([debt()], [pay('d1', 50000)])).newlyAchievedIds).toEqual([])
  })
  it('a debt with nothing owed or paid does not complete the goal', () => {
    expect(reconcileAchievedGoals([goal()], ctx([debt({ startingBalance: 0 })], [])).newlyAchievedIds).toEqual([])
  })
  it('tracks which debts already have a goal, except the one being edited', () => {
    const goals = [goal(), goal({ id: 'g2', linkedDebtIds: ['d2'], status: 'achieved' }), goal({ id: 'g3', linkedDebtIds: ['d3'], status: 'paused' })]
    expect([...trackedDebtIds(goals)].sort()).toEqual(['d1', 'd3'])
    expect([...trackedDebtIds(goals, 'g')].sort()).toEqual(['d3'])
  })
})
