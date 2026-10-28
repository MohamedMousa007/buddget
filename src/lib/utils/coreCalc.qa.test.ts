import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  budgetMonthKeyFor,
  calculateCashOutflow,
  calculateDaysLeftInMonth,
  calculateMonthlyIncome,
  computeDebtPaymentRecord,
  totalDebtRemainingDetail,
  getMonthRange,
  isIncomeOccurrencePending,
} from '@/lib/utils/calculations'
import { paydayDatesForWindow } from '@/lib/utils/paydaySchedule'
import { daysElapsedInMonth, totalDaysInMonth } from '@/lib/utils/spendingPace'
import type { Debt, DebtPayment, IncomeSource } from '@/lib/store/types'

const at = (iso: string) => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(iso))
}
afterEach(() => vi.useRealTimers())
const src = (over: Partial<IncomeSource> = {}) =>
  ({ id: 's', name: 'S', amount: 1000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly', dayOfMonth: 5, createdAt: '2026-01-01T00:00:00Z', ...over }) as IncomeSource

describe('B9 cash outflow with no FX path', () => {
  it('leaves an unconvertible deferred payoff out instead of counting it 1:1', () => {
    const debt = { id: 'd', debtType: 'credit_card', currency: 'JPY', linkedPaymentMethodId: 'pm' } as unknown as Debt
    const pay = { debtId: 'd', amountPaid: 5000 } as DebtPayment
    const out = calculateCashOutflow({ monthExpenses: [], monthDebtPayments: [pay], debts: [debt], monthSavingsDeposits: 10, baseCurrency: 'EGP', exchangeRates: {} })
    expect(out).toBe(10)
  })
})

describe('B12 cycle window', () => {
  it('a custom cycle runs through the end of its last day', () => {
    const { end } = getMonthRange('2026-09', 5)
    expect(end.getDate()).toBe(4)
    expect(end.getHours()).toBe(23)
  })
  it('recurring income outside its effective window is not counted in a dated month', () => {
    const ended = src({ effectiveEnd: '2026-05-31' })
    expect(calculateMonthlyIncome([ended], 'EGP', {}, '2026-09', 1)).toBe(0)
    expect(calculateMonthlyIncome([src()], 'EGP', {}, '2026-09', 1)).toBe(1000)
  })
  it('a one-time source created late on the last cycle day is included', () => {
    const late = src({ isRecurring: false, createdAt: '2026-10-04T15:30:00' })
    expect(calculateMonthlyIncome([late], 'EGP', {}, '2026-09', 5)).toBe(1000)
  })
})

describe('M7 payday on the cycle-start day', () => {
  it('a weekend cycle-start payday moves forward into its cycle and is not shared with the previous one', () => {
    // 2026-09-05 is a Saturday; cycle 2026-09 starts that day.
    const s = src({ dayOfMonth: 5, paydayDays: [5] })
    const cur = paydayDatesForWindow(s, ...Object.values(getMonthRange('2026-09', 5)) as [Date, Date])
    const prev = paydayDatesForWindow(s, ...Object.values(getMonthRange('2026-08', 5)) as [Date, Date])
    expect(cur.map((d) => d.getDate())).toEqual([7])
    expect(prev.map((d) => d.getMonth() + 1 + '/' + d.getDate())).toEqual(['8/5'])
  })
})

describe('M8 income occurrence pending', () => {
  it('a custom-cycle payday earlier than the start day is due in the next calendar month', () => {
    const s = src({ dayOfMonth: 3, paydayDays: [3] })
    // cycle 2026-09 = Sep 25 .. Oct 24; payday Oct 3 (Saturday -> Fri Oct 2)
    expect(isIncomeOccurrencePending(s, [], '2026-09', new Date('2026-09-28T10:00:00'), 25)).toBe(false)
    expect(isIncomeOccurrencePending(s, [], '2026-09', new Date('2026-10-04T10:00:00'), 25)).toBe(true)
  })
  it('day 31 does not break February', () => {
    const s = src({ dayOfMonth: 31, paydayDays: [31] })
    expect(isIncomeOccurrencePending(s, [], '2026-02', new Date('2026-03-01T10:00:00'), 1)).toBe(true)
  })
})

describe('M9 days left on a custom cycle', () => {
  it('counts today when the cycle ends tomorrow', () => {
    at('2026-10-23T15:00:00')
    expect(calculateDaysLeftInMonth('2026-09', 25)).toBe(2)
  })
  it('counts only today on the last day', () => {
    at('2026-10-24T15:00:00')
    expect(calculateDaysLeftInMonth('2026-09', 25)).toBe(1)
  })
})

describe('R33 days left outside the current cycle', () => {
  it('a future cycle has its whole length ahead, not the days until it ends', () => {
    at('2026-10-10T12:00:00')
    expect(calculateDaysLeftInMonth('2026-10', 25)).toBe(31)
  })
  it('a closed cycle has none left', () => {
    at('2026-10-30T12:00:00')
    expect(calculateDaysLeftInMonth('2026-09', 25)).toBe(0)
  })
})

describe('M10 spending pace elapsed days', () => {
  beforeEach(() => at('2026-10-27T12:00:00'))
  it('a closed month has had all of its days', () => {
    expect(daysElapsedInMonth('2026-03', 1)).toBe(31)
    expect(totalDaysInMonth('2026-03', 1)).toBe(31)
  })
  it('the current month counts to today and a future month counts one', () => {
    expect(daysElapsedInMonth('2026-10', 1)).toBe(27)
    expect(daysElapsedInMonth('2026-12', 1)).toBe(1)
  })
})

describe('M11 budget month key', () => {
  it('names the cycle a date falls in', () => {
    expect(budgetMonthKeyFor(new Date('2026-10-20T12:00:00'), 25)).toBe('2026-09')
    expect(budgetMonthKeyFor(new Date('2026-10-25T12:00:00'), 25)).toBe('2026-10')
    expect(budgetMonthKeyFor(new Date('2026-10-20T12:00:00'), 1)).toBe('2026-10')
  })
})

describe('M16 gold debts without a price', () => {
  const gold = { id: 'g', debtType: 'personal', isGold: true, goldKarat: 24, currency: 'XAU', startingBalance: 10, status: 'active' } as unknown as Debt
  it('refuses to record a payment instead of returning 0 grams', () => {
    const r = computeDebtPaymentRecord(gold, 500, 'EGP', 'EGP', {}, 0, [])
    expect(r.ok).toBe(false)
  })
  it('flags the total incomplete when an owed gold debt cannot be priced', () => {
    expect(totalDebtRemainingDetail([gold], [], 'EGP', {}, 0, false)).toEqual({ total: 0, incomplete: true })
    expect(totalDebtRemainingDetail([gold], [], 'EGP', {}, 6000, true)).toEqual({ total: 60000, incomplete: false })
  })
})
