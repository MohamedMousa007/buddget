import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@/lib/store/defaultFinanceData'
import { computeMonthlyStats, type MonthlyStatsInput } from './monthlyStats'
import { totalExpenseBudgetFromPlan } from '@/lib/budget/budgetPlans'
import { buildClose } from '@/lib/budget/monthClose'

const row = (id: string, name: string, amount: number, block: string) =>
  ({ id, name, icon: 'x', amount, subcategories: [], block }) as never

const plan = {
  id: 'p1', name: 'Plan', createdAt: '2026-01-01',
  categories: [row('rent', 'Rent', 4000, 'bills'), row('food', 'Food', 6000, 'everyday'), row('grow', 'Index fund', 1500, 'grow')],
} as never

const input = (over: Partial<MonthlyStatsInput> = {}): MonthlyStatsInput => ({
  expenses: [{ id: 'e1', date: '2026-10-01', amount: 4000, currency: 'EGP', category: 'Rent', description: 'rent' } as never],
  incomeSources: [], incomeEvents: [], budgetCategories: [],
  budgetPlans: [plan], budgetPlanActivations: [], activeBudgetPlanId: 'p1',
  savingsHoldings: [], savingsAccounts: [], savingsTransactions: [], debts: [], debtPayments: [],
  settings: { ...DEFAULT_SETTINGS, baseCurrency: 'EGP', monthStartDay: 1 },
  exchangeRates: {}, goldPricePerGram: 0, goldPriceAvailable: false,
  monthFilter: '2026-10', trustLocalFinance: true,
  ...over,
})

describe('R8 pace judges discretionary spend', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T10:00:00')) })
  afterEach(() => vi.useRealTimers())

  it('a rent payment on day 1 is not extrapolated into Over', () => {
    const st = computeMonthlyStats(input())
    expect(st.paceStatus).toBe('on_track')
    expect(st.projectedSpend).toBe(4000 + 0)
  })

  it('still flags runaway everyday spend', () => {
    const st = computeMonthlyStats(input({
      expenses: [
        { id: 'e1', date: '2026-10-01', amount: 4000, currency: 'EGP', category: 'Rent', description: 'rent' } as never,
        { id: 'e2', date: '2026-10-01', amount: 2000, currency: 'EGP', category: 'Food', description: 'food' } as never,
      ],
    }))
    expect(st.paceStatus).toBe('over')
  })

  it('a closed month projects to what was actually spent', () => {
    const st = computeMonthlyStats(input({ monthFilter: '2026-09', expenses: [{ id: 'e1', date: '2026-09-05', amount: 1000, currency: 'EGP', category: 'Food', description: 'f' } as never] }))
    expect(st.projectedSpend).toBe(1000)
  })

  it('two plan rows sharing a name count the committed budget once', () => {
    const dup = { ...(plan as object), categories: [row('r1', 'Rent', 4000, 'bills'), row('r2', 'Rent', 4000, 'bills'), row('food', 'Food', 6000, 'everyday')] } as never
    const st = computeMonthlyStats(input({ budgetPlans: [dup], expenses: [] }))
    expect(st.projectedSpend).toBe(4000)
  })

  it('a bill paid above its cap counts in full, not scaled', () => {
    const st = computeMonthlyStats(input({
      expenses: [{ id: 'e1', date: '2026-10-01', amount: 4500, currency: 'EGP', category: 'Rent', description: 'rent' } as never],
    }))
    expect(st.projectedSpend).toBe(4500)
  })
})

describe('R16 grow block is not spendable', () => {
  it('excluded from the hero budget and agrees with close and history', () => {
    const st = computeMonthlyStats(input({ monthFilter: '2026-09' }))
    expect(st.totalExpenseBudget).toBe(10000)
    expect(totalExpenseBudgetFromPlan(plan, 'EGP', {})).toBe(10000)
    const close = buildClose([], undefined, { planned: st.totalExpenseBudget, spent: 9000 })
    expect(close.summary.planned).toBe(10000)
    expect(close.summary.result).toEqual({ kind: 'kept', percent: 10 })
  })
})

describe('hero Money in', () => {
  it('receivedIncome counts only realized events, not the expected payday', () => {
    const src = { id: 's1', name: 'Salary', amount: 20000, currency: 'EGP', isRecurring: true, frequency: 'monthly', paydayDays: [25], createdAt: '2026-01-01', startDate: '2026-01-01' } as never
    const st = computeMonthlyStats(input({ incomeSources: [src], monthFilter: '2026-10' }))
    expect(st.receivedIncome).toBe(0)
  })
})
