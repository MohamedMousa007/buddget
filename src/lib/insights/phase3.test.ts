import { describe, expect, it } from 'vitest'
import { debtPayoff } from './debtWhatIf'
import { monthlyPoints, projectNetWorth } from './netWorthPath'
import { buildRecap } from './recap'
import type { InsightSource } from './buildInput'

describe('debtPayoff', () => {
  it('shows how many months an extra payment saves', () => {
    expect(debtPayoff(9600, 1450, 500)).toEqual({ months: 7, monthsWithExtra: 5, monthsSooner: 2 })
    expect(debtPayoff(9600, 1450, 0)?.monthsSooner).toBe(0)
  })
  it('is null with nothing to pay or no monthly payment', () => {
    expect(debtPayoff(0, 1450, 500)).toBeNull()
    expect(debtPayoff(9600, 0, 500)).toBeNull()
  })
  it('ignores a negative extra', () => {
    expect(debtPayoff(1000, 100, -50)?.monthsSooner).toBe(0)
  })
})

describe('monthlyPoints and projectNetWorth', () => {
  const rows = [
    { day: '2026-05-10', net_worth: 90000 }, { day: '2026-05-28', net_worth: 100000 },
    { day: '2026-06-28', net_worth: 110000 }, { day: '2026-07-28', net_worth: '120000' },
    { day: '2026-08-28', net_worth: 130000 }, { day: '2026-09-28', net_worth: 140000 },
  ]
  it('keeps the last snapshot of each month, as day offsets', () => {
    const pts = monthlyPoints(rows)
    expect(pts).toHaveLength(5)
    expect(pts[0]).toEqual({ day: 0, value: 100000 })
    expect(pts[2].value).toBe(120000)
  })
  it('carries a straight line 12 months ahead', () => {
    const path = projectNetWorth(monthlyPoints(rows))
    expect(path).not.toBeNull()
    expect(path!.projected).toBeGreaterThan(140000)
    expect(path!.low).toBeLessThanOrEqual(path!.projected)
    expect(path!.high).toBeGreaterThanOrEqual(path!.projected)
    expect(path!.months).toBe(4)
  })
  it('stays silent under 90 days or 4 points', () => {
    expect(projectNetWorth(monthlyPoints(rows.slice(0, 3)))).toBeNull()
    expect(projectNetWorth([{ day: 0, value: 1 }, { day: 40, value: 2 }, { day: 80, value: 3 }, { day: 85, value: 4 }])).toBeNull()
    expect(projectNetWorth([])).toBeNull()
  })
})

describe('buildRecap', () => {
  const exp = (i: number, date: string, amount: number, category = 'Food') => ({ id: `e${i}`, date, description: `buy ${i}`, category, amount, currency: 'EGP', amountInBaseCurrency: amount, paymentMethodId: 'pm' })
  const src = (expenses: unknown[]) => ({ expenses, incomeSources: [], incomeEvents: [], paymentMethods: [], subscriptions: [], debts: [], debtPayments: [], settings: { baseCurrency: 'EGP', monthStartDay: 1 }, exchangeRates: {}, goldPricePerGram: 0, goldPriceAvailable: false }) as unknown as InsightSource
  const october = Array.from({ length: 9 }, (_, i) => exp(i, `2026-10-${String(i + 2).padStart(2, '0')}`, 100 + i * 10, i === 8 ? 'Shopping' : 'Food'))
  it('tells the last closed cycle', () => {
    const r = buildRecap(src(october), new Date('2026-11-15T10:00:00'))
    expect(r).not.toBeNull()
    expect(r!.cycle).toBe('2026-10')
    expect(r!.purchases).toBe(9)
    expect(r!.spent).toBe(1260)
    expect(r!.topCategory).toEqual({ name: 'Food', amount: 1260 - 180 })
    expect(r!.biggest).toEqual({ description: 'buy 8', amount: 180 })
    expect(r!.days).toBe(31)
    expect(r!.spentBefore).toBeNull()
  })
  it('is null with too few purchases', () => {
    expect(buildRecap(src(october.slice(0, 5)), new Date('2026-11-15T10:00:00'))).toBeNull()
  })
})
