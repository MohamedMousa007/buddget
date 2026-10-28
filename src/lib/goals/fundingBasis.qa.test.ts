import { describe, expect, it } from 'vitest'
import { fundingBasis } from '@/lib/goals/fundingBasis'
import type { Expense, IncomeEvent, IncomeSource } from '@/lib/store/types'

const salary = { id: 's', name: 'Salary', amount: 10000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly', dayOfMonth: 25, createdAt: '2026-01-01T00:00:00Z' } as IncomeSource
const ev = (receivedDate: string, occurrenceDate = receivedDate) =>
  ({ id: receivedDate, templateId: 's', amount: 10000, currency: 'EGP', status: 'confirmed', receivedDate, occurrenceDate, updatedAt: receivedDate }) as IncomeEvent
const exp = (date: string, amount: number, extra: Partial<Expense> = {}) =>
  ({ id: date + amount, date, amount, currency: 'EGP', amountInBaseCurrency: amount, category: 'Food', ...extra }) as Expense

const slice = (expenses: Expense[], incomeEvents: IncomeEvent[], monthStartDay = 1, exchangeRates: Record<string, number> = {}) => ({
  incomeEvents, incomeSources: [salary], expenses, budgetCategories: [], budgetPlans: [], activeBudgetPlanId: null,
  exchangeRates, settings: { baseCurrency: 'EGP' as const, monthStartDay },
})
const now = new Date('2026-10-18T12:00:00')

describe('fundingBasis usualKeep (M18)', () => {
  const events = [ev('2026-07-25'), ev('2026-08-25'), ev('2026-09-25')]

  it('ignores every non-spend row, not just Savings', () => {
    const rows = [exp('2026-09-10', 1000), exp('2026-09-11', 4000, { category: 'Top up' as never })]
    expect(fundingBasis(slice(rows, events) as never, now).usualKeep).toBe(9000)
  })

  it('values spend at the current rates, not the entry-time snapshot', () => {
    const rows = [exp('2026-09-10', 100, { currency: 'USD', amountInBaseCurrency: 3000 })]
    expect(fundingBasis(slice(rows, events, 1, { USD_EGP: 50 }) as never, now).usualKeep).toBe(5000)
  })

  it('uses budget cycles for a custom start day', () => {
    // Cycle 09 (Sep 25..Oct 24) holds the Oct 1 spend (net 8000), cycle 08 the Aug 26 one (net 9000); cycle 07 has no spend.
    const rows = [exp('2026-10-01', 2000), exp('2026-08-26', 1000)]
    const r = fundingBasis(slice(rows, events, 25) as never, new Date('2026-10-30T12:00:00'))
    expect(r.usualKeep).toBe(8500)
  })
})
