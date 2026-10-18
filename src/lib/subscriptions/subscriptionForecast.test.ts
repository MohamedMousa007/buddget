import { describe, expect, it } from 'vitest'
import type { Expense, Subscription } from '@/lib/store/types'
import {
  cycleState,
  forecastCharges,
  heroNumbers,
  leftToPayThisMonth,
  lifecycle,
  markPaidTarget,
  paidThisMonth,
  scheduledDates,
  yearlySetAside,
} from './subscriptionForecast'

const at = (d: string) => new Date(`${d}T12:00:00`)
const ymd = (ds: Date[]) => ds.map((d) => d.toLocaleDateString('sv'))

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  id: 's1', name: 'Netflix', brandKey: 'netflix', planName: 'Standard', planId: null,
  catalogRegion: null, pendingPlanId: null, pendingAmount: null, amount: 100, currency: 'EGP',
  billingCycle: 'monthly', billingDay: 19, startDate: '2026-01-19', nextBillingDate: null,
  paymentMethodId: null, expenseCategory: 'Subscription', linkedRecurringExpenseId: null,
  status: 'active', notes: null, createdAt: '2026-01-01T00:00:00Z', cancelledAt: null, ...over,
})
const paid = (subId: string, date: string, amount = 100): Expense =>
  ({
    id: `e-${subId}-${date}`, date, description: 'x', category: 'Subscription', amount, currency: 'EGP',
    amountInBaseCurrency: amount, paymentMethodId: 'pm', isRecurring: false, linkedSubscriptionId: subId,
    createdAt: '', updatedAt: '',
  }) as Expense

describe('scheduledDates', () => {
  it('clamps month-end billing days and returns to the billing day', () => {
    const s = sub({ startDate: '2026-01-31', billingDay: 31 })
    expect(ymd(scheduledDates(s, at('2026-01-01'), at('2026-04-30')))).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30',
    ])
  })

  it.each([
    ['weekly', ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']],
    ['quarterly', ['2026-10-01']],
    ['semiannual', ['2026-10-01']],
    ['yearly', ['2026-10-01']],
  ] as const)('%s steps from the start date', (cycle, expected) => {
    const s = sub({ billingCycle: cycle, startDate: '2026-04-01', billingDay: 1 })
    const dates =
      cycle === 'weekly'
        ? scheduledDates({ ...s, startDate: '2026-09-17' }, at('2026-10-01'), at('2026-10-31'))
        : scheduledDates({ ...s, startDate: cycle === 'yearly' ? '2025-10-01' : '2026-04-01' }, at('2026-10-01'), at('2026-10-31'))
    expect(ymd(dates)).toEqual(cycle === 'weekly' ? ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29'] : expected)
  })
})

describe('lifecycle', () => {
  it('moves a cancelled plan to ended once access runs out', () => {
    const c = { status: 'cancelled' as const, endsOn: '2026-10-26' }
    expect(lifecycle({ ...c, trialEnd: null }, at('2026-10-26'))).toBe('cancelled')
    expect(lifecycle({ ...c, trialEnd: null }, at('2026-10-27'))).toBe('ended')
  })
  it('bills a trial like an active plan after its last day', () => {
    const t = { status: 'trial' as const, trialEnd: '2026-10-24', endsOn: null }
    expect(lifecycle(t, at('2026-10-24'))).toBe('trial')
    expect(lifecycle(t, at('2026-10-25'))).toBe('active')
  })
})

describe('cycleState', () => {
  const today = at('2026-10-17')
  it('flags an unrecorded charge: today, grace, then overdue after 3 days', () => {
    expect(cycleState(sub({ billingDay: 17, startDate: '2026-01-17' }), [], today).kind).toBe('today')
    expect(cycleState(sub({ billingDay: 16, startDate: '2026-01-16' }), [], today).kind).toBe('grace')
    expect(cycleState(sub({ billingDay: 14, startDate: '2026-01-14' }), [], today).kind).toBe('overdue')
  })
  it('is upcoming once the cycle is paid', () => {
    const s = sub({ billingDay: 14, startDate: '2026-01-14' })
    const c = cycleState(s, [paid('s1', '2026-10-14')], today)
    expect(c.kind).toBe('upcoming')
    expect(c.daysUntil).toBe(28)
  })
  it('never calls a cycle that opened before the subscription was added "expected"', () => {
    const s = sub({ billingDay: 14, startDate: '2026-01-14', createdAt: '2026-10-16T08:00:00' })
    expect(cycleState(s, [], today).kind).toBe('upcoming')
  })
  it('moves past a charge that was marked paid ahead of its due date', () => {
    const s = sub({ billingDay: 19, startDate: '2026-01-19' })
    const c = cycleState(s, [paid('s1', '2026-09-19'), paid('s1', '2026-10-19')], today)
    expect(c.due.toLocaleDateString('sv')).toBe('2026-11-19')
  })
})

describe('markPaidTarget', () => {
  const today = at('2026-10-17')
  const s = sub({ billingDay: 19, startDate: '2026-01-19' })
  it('pays ahead once, then has nothing left', () => {
    const e = [paid('s1', '2026-09-19')]
    expect(markPaidTarget(s, e, today)?.toLocaleDateString('sv')).toBe('2026-10-19')
    expect(markPaidTarget(s, [...e, paid('s1', '2026-10-19')], today)).toBeNull()
  })
  it('does not offer to pay a charge more than a week away', () => {
    expect(markPaidTarget(sub({ billingDay: 28, startDate: '2026-01-28' }), [paid('s1', '2026-09-28')], today)).toBeNull()
  })
  it('targets today for an open unpaid cycle', () => {
    const open = sub({ billingDay: 15, startDate: '2026-01-15' })
    expect(markPaidTarget(open, [], today)?.toLocaleDateString('sv')).toBe('2026-10-17')
  })
})

describe('leftToPayThisMonth', () => {
  const today = at('2026-10-17')
  const rates = { USD_EGP: 50 }
  const subs = [
    sub({ id: 'a', amount: 100, billingDay: 14, startDate: '2026-01-14' }), // unpaid, overdue
    sub({ id: 'b', amount: 200, billingDay: 25, startDate: '2026-01-25' }), // later this month
    sub({ id: 'c', amount: 300, billingDay: 10, startDate: '2026-01-10' }), // paid
    sub({ id: 'y', amount: 1200, billingCycle: 'yearly', billingDay: 20, startDate: '2025-10-20' }),
    sub({ id: 't', amount: 999, status: 'trial', trialEnd: '2026-10-30', billingDay: 22, startDate: '2026-10-22' }),
    sub({ id: 'p', amount: 999, status: 'paused', billingDay: 22, startDate: '2026-01-22' }),
    sub({ id: 'u', amount: 10, currency: 'USD', billingDay: 28, startDate: '2026-01-28' }),
  ]
  const expenses = [paid('c', '2026-10-10', 300)]

  it('sums the real due dates not yet paid, converted, excluding yearly, trial and paused', () => {
    expect(leftToPayThisMonth(subs, expenses, today, 'EGP', rates)).toBe(100 + 200 + 10 * 50)
  })
  it('includes the yearly charge when asked (hero)', () => {
    expect(leftToPayThisMonth(subs, expenses, today, 'EGP', rates, true)).toBe(100 + 200 + 500 + 1200)
  })
  it('uses my share on a shared plan', () => {
    expect(leftToPayThisMonth([sub({ amount: 270, myShare: 135, billingDay: 25, startDate: '2026-01-25' })], [], today, 'EGP', rates)).toBe(135)
  })
})

describe('yearlySetAside', () => {
  it('is amount / 12 for charging yearly plans only', () => {
    const subs = [
      sub({ id: 'y1', amount: 1200, billingCycle: 'yearly' }),
      sub({ id: 'y2', amount: 120, currency: 'USD', billingCycle: 'yearly' }),
      sub({ id: 'm', amount: 999 }),
      sub({ id: 'yp', amount: 999, billingCycle: 'yearly', status: 'paused' }),
    ]
    expect(yearlySetAside(subs, at('2026-10-17'), 'EGP', { USD_EGP: 50 })).toBe(100 + 500)
  })
})

describe('heroNumbers', () => {
  it('forecasts 30 days, paid and left of this month, monthly equivalent and the next charge', () => {
    const today = at('2026-10-17')
    const subs = [
      sub({ id: 'a', amount: 100, billingDay: 14, startDate: '2026-01-14' }),
      sub({ id: 'b', amount: 200, billingDay: 19, startDate: '2026-01-19' }),
      sub({ id: 'y', amount: 1200, billingCycle: 'yearly', billingDay: 30, startDate: '2025-10-30' }),
      sub({ id: 't', amount: 50, status: 'trial', trialEnd: '2026-10-24', billingDay: 25, startDate: '2026-10-25' }),
    ]
    const e = [paid('a', '2026-09-14'), paid('b', '2026-10-05', 640)]
    const h = heroNumbers(subs, e, today, 'EGP', {})
    // a overdue + a next cycle (Nov 14), b on the 19th, y on the 30th; b's Nov 19 is past the 30-day horizon
    expect(h.due30).toBe(100 + 100 + 200 + 1200)
    expect(h.paid).toBe(640)
    expect(h.monthlyEquivalent).toBe(100 + 200 + 100)
    expect(h.perYear).toBe(h.monthlyEquivalent * 12)
    expect(h.next?.sub.id).toBe('b')
  })
})

describe('forecastCharges / paidThisMonth', () => {
  it('does not forecast a cycle that is already paid', () => {
    const s = sub({ billingDay: 19, startDate: '2026-01-19' })
    const list = forecastCharges([s], [paid('s1', '2026-09-19'), paid('s1', '2026-10-19')], at('2026-10-17'), 30, 'EGP', {})
    expect(list).toEqual([])
  })
  it('counts only linked, non-refunded charges of this month', () => {
    const e = [paid('s1', '2026-10-02', 50), { ...paid('s1', '2026-10-03', 70), refundKind: 'refunded' as const }, paid('s1', '2026-09-30', 90)]
    expect(paidThisMonth(e, at('2026-10-17'))).toBe(50)
  })
})
