import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/lib/store/defaultFinanceData'
import { computeMonthlyStats, type MonthlyStatsInput } from './monthlyStats'

const input = (over: Partial<MonthlyStatsInput> = {}): MonthlyStatsInput => ({
  expenses: [
    { id: 'e1', date: '2026-10-05', amount: 300, currency: 'EGP', category: 'Food', description: 'x' } as never,
  ],
  incomeSources: [],
  incomeEvents: [
    { id: 'i1', name: 'Pay', amount: 5000, currency: 'EGP', receivedDate: '2026-10-02', status: 'confirmed', sourceType: 'other' } as never,
  ],
  budgetCategories: [{ category: 'Food', budgetedAmount: 1000, currency: 'EGP' } as never],
  budgetPlans: [],
  budgetPlanActivations: [],
  activeBudgetPlanId: null,
  savingsHoldings: [],
  savingsAccounts: [],
  savingsTransactions: [],
  debts: [],
  debtPayments: [],
  settings: { ...DEFAULT_SETTINGS, baseCurrency: 'EGP', monthStartDay: 1 },
  exchangeRates: {},
  goldPricePerGram: 0,
  goldPriceAvailable: false,
  monthFilter: '2026-10',
  trustLocalFinance: true,
  ...over,
})

describe('single Left to spend', () => {
  it('equals budget minus spent, the hero definition', () => {
    const st = computeMonthlyStats(input())
    expect(st.leftToSpend).toBe(st.totalExpenseBudget - st.totalSpentExcludingSavings)
    expect(st.leftToSpend).toBe(st.remaining)
  })

  it('keeps the cash-flow figure under its own name', () => {
    const st = computeMonthlyStats(input())
    expect(st.netCashFlow).not.toBe(st.leftToSpend)
  })
})
