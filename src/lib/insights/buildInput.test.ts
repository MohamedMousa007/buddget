import { describe, expect, it } from 'vitest'
import { addDays, format } from 'date-fns'
import { DEFAULT_CASH_ID } from '@/lib/store/migrations/v17_uuid_remap'
import { buildInsightInput, type InsightSource } from './buildInput'
import { heroAnswer } from './detectors'
import { computeInsights } from './rank'

// A believable user: 150 days of purchases, monthly pay on the 25th, a card, cash, a BNPL plan and two subscriptions.
const NOW = new Date('2026-11-17T12:00:00')
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

function fixture(): InsightSource {
  const expenses = Array.from({ length: 150 }, (_, i) => {
    const d = addDays(NOW, -i)
    const payWeek = d.getDate() >= 25 || d.getDate() <= 2
    const amount = (payWeek ? 420 : 210) + (i % 7) * 10
    return {
      id: `e${i}`, date: iso(d), description: `shop ${i % 5}`, category: i % 4 === 0 ? 'Transport' : 'Food', amount, currency: 'EGP', amountInBaseCurrency: amount,
      paymentMethodId: i % 11 === 0 ? DEFAULT_CASH_ID : i % 3 === 0 ? 'cash' : 'card', ...(i % 11 === 0 ? { smsLogId: 'sms' } : {}),
    }
  })
  const incomeEvents = [0, 1, 2, 3, 4].map((m) => ({
    id: `i${m}`, name: 'Salary', amount: 30000, currency: 'EGP', receivedDate: iso(new Date(2026, 6 + m, 25)), occurrenceDate: iso(new Date(2026, 6 + m, 25)), status: 'confirmed', createdAt: '', updatedAt: '',
  }))
  return {
    expenses, incomeEvents, incomeSources: [],
    paymentMethods: [{ id: 'cash', name: 'Cash', type: 'cash' }, { id: DEFAULT_CASH_ID, name: 'Cash', type: 'cash' }, { id: 'card', name: 'Visa', type: 'credit_card' }, { id: 'bnpl', name: 'valU', type: 'bnpl' }],
    subscriptions: [
      { id: 's1', name: 'Netflix', amount: 200, currency: 'EGP', billingCycle: 'monthly', billingDay: 20, startDate: '2026-01-20', status: 'active', nextBillingDate: '2026-11-20', createdAt: '2026-01-20T00:00:00Z' },
      { id: 's2', name: 'iCloud', amount: 120, currency: 'EGP', billingCycle: 'yearly', billingDay: 3, startDate: '2026-03-03', status: 'active', nextBillingDate: '2027-03-03', createdAt: '2026-03-03T00:00:00Z' },
    ],
    debts: [
      { id: 'd1', name: 'Phone', debtType: 'installment', direction: 'i_owe', status: 'active', currency: 'EGP', isGold: false, startingBalance: 6000, installmentCount: 6, installmentAmount: 1000, installmentFrequency: 'monthly', linkedPaymentMethodId: 'bnpl' },
      { id: 'd2', name: 'TV', debtType: 'installment', direction: 'i_owe', status: 'active', currency: 'EGP', isGold: false, startingBalance: 3600, installmentCount: 12, installmentAmount: 300, installmentFrequency: 'monthly', linkedPaymentMethodId: 'bnpl' },
    ],
    debtPayments: [],
    settings: { baseCurrency: 'EGP', monthStartDay: 25 },
    exchangeRates: {}, goldPricePerGram: 0, goldPriceAvailable: false,
  } as unknown as InsightSource
}

describe('buildInsightInput on a realistic store', () => {
  const input = buildInsightInput(fixture(), 3000, NOW)
  it('measures the running cycle', () => {
    expect(input.cycle.daysElapsed).toBeGreaterThan(0)
    expect(input.cycle.daysLeft).toBeGreaterThanOrEqual(0)
    expect(input.cycle.daysElapsed + input.cycle.daysLeft).toBe(input.cycle.totalDays)
    expect(input.spent).toBeGreaterThan(0)
    expect(Number.isFinite(input.projectedSpend)).toBe(true)
  })
  it('finds the 3 closed cycles and a payday lift', () => {
    expect(input.usualSpend).not.toBeNull()
    expect(input.paydays.count).toBeGreaterThanOrEqual(3)
    expect(input.paydays.liftPct).toBeGreaterThan(25)
  })
  it('a borrowed deposit is not a payday', () => {
    const src = fixture()
    const borrowed = { id: 'b1', name: 'From Omar', amount: 9000, currency: 'EGP', receivedDate: '2026-09-10', status: 'confirmed', createdAt: '', updatedAt: '' }
    const withBorrowed = (extra: object) => buildInsightInput({ ...src, incomeEvents: [...src.incomeEvents, { ...borrowed, ...extra }] } as unknown as InsightSource, 3000, NOW).paydays
    expect(withBorrowed({}).purchases).not.toBe(input.paydays.purchases)
    expect(withBorrowed({ linkedDebtId: 'd9' })).toEqual(input.paydays)
    expect(withBorrowed({ sourceType: 'debt' })).toEqual(input.paydays)
    expect(withBorrowed({ exclusion: 'own_transfer' })).toEqual(input.paydays)
  })
  it('keeps unassigned bank texts out of card and cash', () => {
    expect(input.pay.unassigned).toBeGreaterThan(0)
    expect(input.pay.cash).toBeGreaterThan(0)
    expect(input.pay.card).toBeGreaterThan(0)
  })
  it('totals BNPL plans and the debt plan', () => {
    expect(input.bnpl.plans).toBe(2)
    expect(input.bnpl.remaining).toBe(9600)
    expect(input.bnpl.monthly).toBe(1300)
    expect(input.debtPlan).toEqual({ remaining: 9600, monthly: 1300 })
  })
  it('counts subscriptions at a monthly equivalent', () => {
    expect(input.subs.count).toBe(2)
    expect(input.subs.monthly).toBeCloseTo(210)
  })
  it('never produces NaN anywhere and yields ranked findings', () => {
    const bad = JSON.stringify(input, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? 'NaN' : v)).includes('"NaN"')
    expect(bad).toBe(false)
    const found = computeInsights(input)
    expect(found.length).toBeGreaterThan(3)
    expect(heroAnswer(input).state).not.toBe('learning')
    expect(found.slice(0, 3).every((f) => !f.pro)).toBe(true)
  })
})
