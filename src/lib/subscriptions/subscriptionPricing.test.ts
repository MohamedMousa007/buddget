import { describe, expect, it } from 'vitest'
import type { Expense } from '@/lib/store/types'
import { fxEstimate, lastCharge, priceChange } from './subscriptionPricing'
import { trackingAction } from './subscriptionTracking'

const charge = (subId: string, date: string, amount: number, currency = 'EGP', base = amount): Expense =>
  ({ id: date, date, amount, currency, amountInBaseCurrency: base, linkedSubscriptionId: subId }) as Expense

const plan = { id: 's', amount: 190, myShare: null, currency: 'EGP' as const, pendingPlanId: null }

describe('priceChange', () => {
  it('flags a last charge more than 5% off the plan, with a signed one-decimal percent', () => {
    expect(priceChange(plan, [charge('s', '2026-10-19', 210)])).toEqual({ from: 190, to: 210, pct: 10.5 })
    expect(priceChange(plan, [charge('s', '2026-10-19', 170)])?.pct).toBe(-10.5)
  })
  it('ignores moves of 5% or less', () => {
    expect(priceChange(plan, [charge('s', '2026-10-19', 199.5)])).toBeNull()
  })
  it('uses the most recent charge and skips refunded ones', () => {
    const e = [charge('s', '2026-08-19', 300), { ...charge('s', '2026-10-19', 400), refundKind: 'refunded' as const }, charge('s', '2026-09-19', 190)]
    expect(lastCharge('s', e)?.date).toBe('2026-09-19')
    expect(priceChange(plan, e)).toBeNull()
  })
  it('does not compare a charge billed in another currency (that is FX, not price)', () => {
    expect(priceChange({ ...plan, currency: 'USD', amount: 20 }, [charge('s', '2026-10-19', 1069, 'EGP')])).toBeNull()
  })
  it('stays quiet while a plan change is pending', () => {
    expect(priceChange({ ...plan, pendingPlanId: 'netflix_premium' }, [charge('s', '2026-10-19', 270)])).toBeNull()
  })
  it('does not flag a shared plan recorded as my share', () => {
    expect(priceChange({ ...plan, amount: 270, myShare: 135 }, [charge('s', '2026-10-19', 135)])).toBeNull()
  })
})

describe('shared plans', () => {
  it('a full-price bank charge is not a price rise', () => {
    expect(priceChange({ ...plan, amount: 100, myShare: 25 }, [charge('s', '2026-10-19', 100)])).toBeNull()
  })
  it('derives the FX rate from the full price, not my share', () => {
    const usd = { id: 's', amount: 20, myShare: 5, currency: 'USD' as const }
    const f = fxEstimate(usd, 'EGP', { USD_EGP: 53.45 }, [charge('s', '2026-09-21', 1090, 'EGP')])
    expect(f.rate).toBeCloseTo(54.5, 5)
    expect(f.estimate).toBeCloseTo(272.5, 5)
  })
})

describe('fxEstimate', () => {
  const usd = { id: 's', amount: 20, myShare: null, currency: 'USD' as const }
  const rates = { USD_EGP: 53.45 }
  it('uses the quoted rate before any real charge', () => {
    const f = fxEstimate(usd, 'EGP', rates, [])
    expect(f.estimate).toBeCloseTo(1069, 5)
    expect(f).toMatchObject({ refined: false, drift: 0 })
  })
  it('refines from the last real EGP charge and reports the drift', () => {
    const f = fxEstimate(usd, 'EGP', rates, [charge('s', '2026-09-21', 1090.4, 'EGP')])
    expect(f.refined).toBe(true)
    expect(f.rate).toBeCloseTo(54.52, 2)
    expect(f.estimate).toBeCloseTo(1090.4, 5)
    expect(f.drift).toBeCloseTo(0.02, 2)
  })
  it('is exact in the base currency', () => {
    expect(fxEstimate({ ...usd, currency: 'EGP', amount: 190 }, 'EGP', rates, [])).toEqual({ estimate: 190, rate: 1, refined: false, drift: 0 })
  })
  it('does not treat a USD-denominated charge as a real bank rate', () => {
    expect(fxEstimate(usd, 'EGP', rates, [charge('s', '2026-09-21', 20, 'USD', 1000)]).refined).toBe(false)
  })
})

describe('trackingAction', () => {
  const due = (kind: 'today' | 'grace' | 'overdue' | 'upcoming') => ({ due: new Date(), kind, daysUntil: 0 })
  it('waits for the SMS in sms mode and legacy rows', () => {
    expect(trackingAction('sms', due('overdue'))).toBe('none')
    expect(trackingAction(undefined, due('today'))).toBe('none')
  })
  it('asks on the due date in ask mode', () => {
    expect(trackingAction('ask', due('today'))).toBe('ask')
    expect(trackingAction('ask', due('grace'))).toBe('ask')
  })
  it('logs automatically in log mode', () => {
    expect(trackingAction('log', due('today'))).toBe('log')
    expect(trackingAction('log', due('overdue'))).toBe('log')
  })
  it('does nothing while the charge is still upcoming, in every mode', () => {
    for (const m of ['sms', 'ask', 'log'] as const) expect(trackingAction(m, due('upcoming'))).toBe('none')
  })
})
