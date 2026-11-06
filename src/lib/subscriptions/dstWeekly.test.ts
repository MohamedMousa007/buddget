import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { format } from 'date-fns'
import { computeNextBillingDate } from '@/lib/subscriptions/subscriptionDates'
import { forecastCharges, scheduledDates } from '@/lib/subscriptions/subscriptionForecast'
import { isCyclePaid } from '@/lib/subscriptions/subscriptionOccurrence'
import { BACKFILL_CYCLES, chargesToLog, subscriptionChargeId } from '@/lib/subscriptions/logDue'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { PaymentMethod } from '@/lib/store/types'

const sub = { id: 's', startDate: '2026-01-02', billingDay: 2, billingCycle: 'weekly' as const, name: 'x', status: 'active' as const, amount: 10, currency: 'EGP' as const, myShare: null, trialEnd: null, endsOn: null, createdAt: '2026-01-01T00:00:00Z' }
const at = (s: string) => new Date(`${s}T00:00:00`)
const iso = (d: Date) => format(d, 'yyyy-MM-dd')

describe('DEB-1 / TZL-2: weekly Friday subscription across the Cairo DST-start Friday', () => {
  it('scheduledDates includes the last day of the window and every date is local midnight', () => {
    expect(scheduledDates(sub as never, at('2026-05-01'), at('2026-05-15')).map(iso)).toEqual(['2026-05-01', '2026-05-08', '2026-05-15'])
    const dates = scheduledDates(sub as never, at('2026-05-01'), at('2027-05-01'))
    expect(dates.every((d) => d.getTime() === new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())).toBe(true)
  })
  it('a Friday charge dated that day is seen as paid (the cycle never drifts to 01:00)', () => {
    for (let i = 0; i < 104; i++) {
      const due = new Date(2026, 0, 2 + 7 * i)
      const exp = [{ linkedSubscriptionId: 's', date: iso(due), refundKind: undefined }]
      expect(isCyclePaid(sub, exp, due)).toBe(true)
    }
  })
  it('forecast labels the charge on today as today', () => {
    const f = forecastCharges([sub as never], [], at('2026-05-15'), 14, 'EGP', {})
    expect(f.find((x) => iso(x.due) === '2026-05-15')?.kind).toBe('today')
  })
  it('computeNextBillingDate is stable after the DST Friday', () => {
    expect(computeNextBillingDate('2026-01-02', 2, 'weekly', at('2026-05-15'))).toBe('2026-05-15')
  })
})

describe('log mode: idempotent, back-filled, bounded', () => {
  const pm = { id: 'pm1', name: 'Visa', type: 'credit_card', currency: 'EGP', isDefault: true } as PaymentMethod
  type Input = Parameters<ReturnType<typeof useFinanceStore.getState>['addSubscription']>[0]
  const input = (over: Partial<Input>): Input => ({
    name: 'Svc', brandKey: null, planName: null, planId: null, catalogRegion: null, pendingPlanId: null, pendingAmount: null,
    amount: 100, currency: 'EGP', billingCycle: 'monthly', billingDay: 10, startDate: '2026-01-10', nextBillingDate: null,
    paymentMethodId: 'pm1', expenseCategory: 'Enjoyment', status: 'active', notes: null, tracking: 'log', ...over,
  }) as Input
  const st = () => useFinanceStore.getState()
  const rows = () => st().expenses.filter((e) => e.linkedSubscriptionId).map((e) => e.date).sort()

  beforeEach(() => { useFinanceStore.setState({ subscriptions: [], recurringExpenses: [], expenses: [], paymentMethods: [pm] }) })
  afterEach(() => vi.useRealTimers())

  it('weekly Friday for two years, visited daily: one row per week (105), none duplicated', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 0, 2, 9))
    st().addSubscription(input({ billingCycle: 'weekly', billingDay: 1, startDate: '2026-01-02' }))
    for (let i = 0; i <= 7 * 104; i++) {
      vi.setSystemTime(new Date(2026, 0, 2 + i, 9))
      st().logDueSubscriptions()
    }
    const got = rows()
    expect(got.length).toBe(105)
    expect(new Set(got).size).toBe(105)
  })

  it('running twice in one day, or on two devices, writes the same row once', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 0, 10, 9))
    st().addSubscription(input({}))
    st().logDueSubscriptions()
    st().logDueSubscriptions()
    expect(rows()).toEqual(['2026-01-10'])
    const id = st().expenses[0].id
    const sid = st().subscriptions[0].id
    expect(id).toBe(subscriptionChargeId(sid, '2026-01-10'))
  })

  it('catches up the months missed while the app was closed, at most three', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 0, 10, 9))
    st().addSubscription(input({}))
    st().logDueSubscriptions()
    vi.setSystemTime(new Date(2026, 7, 20, 9))
    st().logDueSubscriptions()
    expect(rows()).toEqual(['2026-01-10', '2026-06-10', '2026-07-10', '2026-08-10'])
    expect(BACKFILL_CYCLES).toBe(3)
  })

  it('does not back-fill cycles that opened before the subscription was tracked', () => {
    vi.useFakeTimers().setSystemTime(new Date(2026, 5, 15, 9))
    const s = { ...sub, id: 'n', startDate: '2026-01-10', billingCycle: 'monthly' as const, billingDay: 10, createdAt: new Date(2026, 5, 15, 9).toISOString(), trialEnd: null }
    expect(chargesToLog(s, [], new Date())).toEqual([])
  })
})
