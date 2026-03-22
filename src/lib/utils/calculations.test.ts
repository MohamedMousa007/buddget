import { describe, it, expect } from 'vitest'
import {
  calculateMonthlyIncome,
  calculateRecurringIncomeForCalendarMonth,
  sumRecurringIncomeOverDateRange,
  incomeMonthlyMultiplier,
  goldPurityFactor,
  goldGramsToMoney,
  moneyToGoldGrams,
} from './calculations'
import type { IncomeSource } from '@/lib/store/types'

const jan2025 = new Date('2025-01-15T12:00:00.000Z')

function src(partial: Partial<IncomeSource> & Pick<IncomeSource, 'id' | 'name' | 'amount' | 'currency'>): IncomeSource {
  return {
    isRecurring: true,
    dayOfMonth: 1,
    createdAt: '2024-06-01T00:00:00.000Z',
    ...partial,
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
  it('sums only recurring sources', () => {
    const sources: IncomeSource[] = [
      src({ id: '1', name: 'A', amount: 1000, currency: 'AED', isRecurring: true }),
      src({ id: '2', name: 'B', amount: 500, currency: 'AED', isRecurring: false }),
    ]
    expect(calculateMonthlyIncome(sources, 'AED', {})).toBe(1000)
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
