import { describe, it, expect } from 'vitest'
import {
  calculateMonthlyIncome,
  calculateRecurringIncomeForCalendarMonth,
  sumRecurringIncomeOverDateRange,
  projectedIncomeForMonth,
  actualIncomeForMonth,
  incomeMonthlyMultiplier,
  goldPurityFactor,
  goldGramsToMoney,
  moneyToGoldGrams,
  calculateTotalSpent,
  calculateTotalSpentExcludingSavings,
  calculateTotalBudget,
  calculateTotalBudgetExcludingSavings,
  expenseAmountInBase,
} from './calculations'
import type { IncomeSource, IncomeEvent, Expense, BudgetCategory } from '@/lib/store/types'
import { DEFAULT_SETTINGS } from '@/lib/store/defaultFinanceData'

const jan2025 = new Date('2025-01-15T12:00:00.000Z')

function src(partial: Partial<IncomeSource> & Pick<IncomeSource, 'id' | 'name' | 'amount' | 'currency'>): IncomeSource {
  const createdAt = partial.createdAt ?? '2024-06-01T00:00:00.000Z'
  return {
    isRecurring: true,
    dayOfMonth: 1,
    ...partial,
    createdAt,
    updatedAt: partial.updatedAt ?? createdAt,
    // Default effective window to the creation date so createdAt-based tests keep their intent.
    effectiveStart: partial.effectiveStart ?? createdAt.slice(0, 10),
  }
}

describe('incomeMonthlyMultiplier', () => {
  it('normalizes weekly and bi-weekly to monthly equivalent factors', () => {
    expect(incomeMonthlyMultiplier('monthly')).toBe(1)
    expect(incomeMonthlyMultiplier(undefined)).toBe(1)
    expect(incomeMonthlyMultiplier('weekly')).toBeCloseTo(52 / 12, 10)
    expect(incomeMonthlyMultiplier('biweekly')).toBeCloseTo(26 / 12, 10)
  })
})

describe('calculateMonthlyIncome', () => {
  it('sums recurring sources; omits one-time when month params omitted', () => {
    const sources: IncomeSource[] = [
      src({ id: '1', name: 'A', amount: 1000, currency: 'AED', isRecurring: true }),
      src({ id: '2', name: 'B', amount: 500, currency: 'AED', isRecurring: false }),
    ]
    expect(calculateMonthlyIncome(sources, 'AED', {})).toBe(1000)
  })

  it('adds one-time sources whose createdAt falls in the selected month', () => {
    const sources: IncomeSource[] = [
      src({ id: '1', name: 'A', amount: 1000, currency: 'AED', isRecurring: true }),
      src({
        id: '2',
        name: 'B',
        amount: 500,
        currency: 'AED',
        isRecurring: false,
        createdAt: '2025-01-15T12:00:00.000Z',
      }),
    ]
    expect(calculateMonthlyIncome(sources, 'AED', {}, '2025-01', 1)).toBe(1500)
  })

  it('excludes one-time sources outside the selected month', () => {
    const sources: IncomeSource[] = [
      src({
        id: '2',
        name: 'B',
        amount: 500,
        currency: 'AED',
        isRecurring: false,
        createdAt: '2025-02-15T12:00:00.000Z',
      }),
    ]
    expect(calculateMonthlyIncome(sources, 'AED', {}, '2025-01', 1)).toBe(0)
  })

  it('treats weekly amount as per-week before monthly conversion', () => {
    const sources: IncomeSource[] = [
      src({
        id: '1',
        name: 'W',
        amount: 300,
        currency: 'AED',
        isRecurring: true,
        recurringFrequency: 'weekly',
      }),
    ]
    expect(calculateMonthlyIncome(sources, 'AED', {})).toBeCloseTo(300 * (52 / 12), 5)
  })
})

describe('projectedIncomeForMonth', () => {
  it('counts an active recurring template at its monthly equivalent', () => {
    const sources = [src({ id: '1', name: 'Salary', amount: 5000, currency: 'AED', effectiveStart: '2024-01-01' })]
    expect(projectedIncomeForMonth(sources, 'AED', {}, '2025-01', 1)).toBe(5000)
  })

  it('excludes a source whose effectiveStart is after the month', () => {
    const sources = [src({ id: '1', name: 'Future', amount: 5000, currency: 'AED', effectiveStart: '2025-03-01' })]
    expect(projectedIncomeForMonth(sources, 'AED', {}, '2025-01', 1)).toBe(0)
  })

  it('excludes a source whose effectiveEnd is before the month', () => {
    const sources = [
      src({ id: '1', name: 'Old job', amount: 5000, currency: 'AED', effectiveStart: '2023-01-01', effectiveEnd: '2024-12-31' }),
    ]
    expect(projectedIncomeForMonth(sources, 'AED', {}, '2025-01', 1)).toBe(0)
  })

  it('models a raise: old ends June, new starts July', () => {
    const sources = [
      src({ id: 'old', name: 'Salary', amount: 5000, currency: 'AED', effectiveStart: '2024-01-01', effectiveEnd: '2025-06-30' }),
      src({ id: 'new', name: 'Salary', amount: 6000, currency: 'AED', effectiveStart: '2025-07-01' }),
    ]
    expect(projectedIncomeForMonth(sources, 'AED', {}, '2025-06', 1)).toBe(5000)
    expect(projectedIncomeForMonth(sources, 'AED', {}, '2025-07', 1)).toBe(6000)
  })

  it('includes one-time income received inside the month window', () => {
    const sources = [
      src({ id: '1', name: 'Bonus', amount: 1000, currency: 'AED', isRecurring: false, createdAt: '2025-01-10T00:00:00.000Z' }),
    ]
    expect(projectedIncomeForMonth(sources, 'AED', {}, '2025-01', 1)).toBe(1000)
  })

  it('respects a custom monthStartDay window for one-time income', () => {
    // Cycle starting on the 15th: Jan-15 → Feb-14. A one-time on Feb-10 belongs to the "2025-01" cycle.
    const sources = [
      src({ id: '1', name: 'Late', amount: 1000, currency: 'AED', isRecurring: false, createdAt: '2025-02-10T00:00:00.000Z' }),
    ]
    expect(projectedIncomeForMonth(sources, 'AED', {}, '2025-01', 15)).toBe(1000)
    expect(projectedIncomeForMonth(sources, 'AED', {}, '2025-02', 15)).toBe(0)
  })
})

describe('actualIncomeForMonth', () => {
  const jan = '2025-01'
  const evt = (p: Partial<IncomeEvent> & Pick<IncomeEvent, 'id' | 'amount'>): IncomeEvent => ({
    name: 'E',
    currency: 'AED',
    receivedDate: '2025-01-15',
    status: 'confirmed',
    createdAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2025-01-15T00:00:00.000Z',
    ...p,
  })

  it('with no events, a recurring template equals its projection', () => {
    const tmpl = [src({ id: 't1', name: 'Salary', amount: 5000, currency: 'AED', effectiveStart: '2024-01-01' })]
    expect(actualIncomeForMonth(tmpl, [], 'AED', {}, jan, 1)).toBe(
      projectedIncomeForMonth(tmpl, 'AED', {}, jan, 1)
    )
  })

  it('a confirmed event replaces the monthly projection', () => {
    const tmpl = [src({ id: 't1', name: 'Salary', amount: 5000, currency: 'AED', effectiveStart: '2024-01-01' })]
    const events = [evt({ id: 'e1', templateId: 't1', amount: 5200 })]
    expect(actualIncomeForMonth(tmpl, events, 'AED', {}, jan, 1)).toBe(5200)
  })

  it('a missed event suppresses the projected fallback (counts 0)', () => {
    const tmpl = [src({ id: 't1', name: 'Salary', amount: 5000, currency: 'AED', effectiveStart: '2024-01-01' })]
    const events = [evt({ id: 'e1', templateId: 't1', amount: 5000, status: 'missed' })]
    expect(actualIncomeForMonth(tmpl, events, 'AED', {}, jan, 1)).toBe(0)
  })

  it('bi-weekly: one confirmed paycheck + one projected fallback', () => {
    const tmpl = [
      src({ id: 't1', name: 'Wage', amount: 1000, currency: 'AED', recurringFrequency: 'biweekly', effectiveStart: '2024-01-01' }),
    ]
    const events = [evt({ id: 'e1', templateId: 't1', amount: 1000, receivedDate: '2025-01-05' })]
    // round(26/12)=2 expected occurrences: 1 confirmed (1000) + 1 fallback (1000) = 2000.
    expect(actualIncomeForMonth(tmpl, events, 'AED', {}, jan, 1)).toBe(2000)
  })

  it('does not double-count a one-time source backfilled to an event (same id)', () => {
    const oneTime = src({
      id: 's1', name: 'Bonus', amount: 800, currency: 'AED', isRecurring: false,
      createdAt: '2025-01-10T00:00:00.000Z',
    })
    const event = evt({ id: 's1', templateId: null, amount: 800, receivedDate: '2025-01-10' })
    expect(actualIncomeForMonth([oneTime], [event], 'AED', {}, jan, 1)).toBe(800)
  })

  it('counts a new one-time source that has no event yet', () => {
    const oneTime = src({
      id: 's2', name: 'Gift', amount: 300, currency: 'AED', isRecurring: false,
      createdAt: '2025-01-20T00:00:00.000Z',
    })
    expect(actualIncomeForMonth([oneTime], [], 'AED', {}, jan, 1)).toBe(300)
  })
})

describe('calculateRecurringIncomeForCalendarMonth', () => {
  it('excludes sources created after month end', () => {
    const sources: IncomeSource[] = [
      src({
        id: '1',
        name: 'Old',
        amount: 1000,
        currency: 'AED',
        createdAt: '2024-01-01T00:00:00.000Z',
      }),
      src({
        id: '2',
        name: 'New',
        amount: 2000,
        currency: 'AED',
        createdAt: '2025-02-01T00:00:00.000Z',
      }),
    ]
    expect(calculateRecurringIncomeForCalendarMonth(sources, 'AED', {}, jan2025)).toBe(1000)
  })

  it('includes source created during the month before month end', () => {
    const sources: IncomeSource[] = [
      src({
        id: '1',
        name: 'Mid',
        amount: 3000,
        currency: 'AED',
        createdAt: '2025-01-10T00:00:00.000Z',
      }),
    ]
    expect(calculateRecurringIncomeForCalendarMonth(sources, 'AED', {}, jan2025)).toBe(3000)
  })
})

describe('sumRecurringIncomeOverDateRange', () => {
  it('sums full recurring amount for each overlapping calendar month', () => {
    const sources: IncomeSource[] = [
      src({ id: '1', name: 'Job', amount: 1000, currency: 'AED', createdAt: '2020-01-01T00:00:00.000Z' }),
    ]
    const start = new Date('2025-01-10')
    const end = new Date('2025-03-20')
    expect(sumRecurringIncomeOverDateRange(sources, 'AED', {}, start, end)).toBe(3000)
  })
})

describe('spending and budget excluding Savings', () => {
  const baseExpense = {
    id: '1',
    date: '2025-01-15',
    description: 'x',
    amount: 100,
    currency: 'AED' as const,
    amountInBaseCurrency: 100,
    paymentMethodId: 'pm',
    isRecurring: false,
    createdAt: '2025-01-15',
    updatedAt: '2025-01-15',
  }
  const food: Expense = { ...baseExpense, category: 'Food' }
  const savings: Expense = { ...baseExpense, id: '2', category: 'Savings' }

  it('calculateTotalSpentExcludingSavings omits Savings category', () => {
    expect(calculateTotalSpent([food, savings], 'AED', {})).toBe(200)
    expect(calculateTotalSpentExcludingSavings([food, savings], 'AED', {})).toBe(100)
  })

  it('excludes all non-spend money-movement categories from spend totals', () => {
    const transfer: Expense = { ...baseExpense, id: '3', category: 'Transfer' }
    const atm: Expense = { ...baseExpense, id: '4', category: 'ATM Cash Withdrawal' }
    const fx: Expense = { ...baseExpense, id: '5', category: 'Currency Exchange' }
    const ccPay: Expense = { ...baseExpense, id: '6', category: 'CC Payoff' }
    const all = [food, savings, transfer, atm, fx, ccPay]
    // Only the Food expense counts toward spend; the 5 movements are excluded.
    expect(calculateTotalSpentExcludingSavings(all, 'AED', {})).toBe(100)
  })

  it('calculateTotalBudgetExcludingSavings omits Savings row', () => {
    const cats: BudgetCategory[] = [
      { category: 'Food', budgetedAmount: 500, currency: 'AED' },
      { category: 'Savings', budgetedAmount: 200, currency: 'AED' },
    ]
    expect(calculateTotalBudget(cats, DEFAULT_SETTINGS, 0)).toBe(700)
    expect(calculateTotalBudgetExcludingSavings(cats, DEFAULT_SETTINGS, 0)).toBe(500)
  })
})

describe('expenseAmountInBase', () => {
  const rates = { USD_AED: 3.6725, EUR_AED: 4.02 }

  it('recomputes in primary currency from original amount when base changes', () => {
    const e: Pick<Expense, 'amount' | 'currency' | 'amountInBaseCurrency'> = {
      amount: 100,
      currency: 'USD',
      amountInBaseCurrency: 5023.94,
    }
    const inEur = expenseAmountInBase(e, 'EUR', rates)
    expect(inEur).toBeCloseTo(100 * (3.6725 / 4.02), 4)
  })

  it('calculateTotalSpent uses live conversion not stale amountInBaseCurrency', () => {
    const expenses: Expense[] = [
      {
        id: '1',
        date: '2026-03-01',
        description: 'x',
        category: 'Food',
        amount: 100,
        currency: 'USD',
        amountInBaseCurrency: 5023.94,
        paymentMethodId: 'pm',
        isRecurring: false,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    ]
    const total = calculateTotalSpent(expenses, 'EUR', rates)
    expect(total).toBeCloseTo(100 * (3.6725 / 4.02), 4)
  })
})

describe('gold helpers', () => {
  it('goldPurityFactor', () => {
    expect(goldPurityFactor(24)).toBe(1)
    expect(goldPurityFactor(18)).toBe(0.75)
  })

  it('moneyToGoldGrams returns 0 when price invalid', () => {
    expect(moneyToGoldGrams(100, 0, 24)).toBe(0)
  })

  it('goldGramsToMoney round trip-ish', () => {
    const grams = moneyToGoldGrams(1000, 350, 22)
    const back = goldGramsToMoney(grams, 350, 22)
    expect(back).toBeCloseTo(1000, 0)
  })
})
