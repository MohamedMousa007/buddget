import { describe, expect, it } from 'vitest'
import type { Expense, Subscription } from '@/lib/store/types'
import { buildHomeLists, buildRow } from './subscriptionRows'
import { pickNudge, railInsights, thirtyDayStrip } from './subscriptionNudges'

const today = new Date('2026-10-17T12:00:00')
const sub = (over: Partial<Subscription> = {}): Subscription => ({
  id: 's1', name: 'Netflix', brandKey: 'netflix', planName: 'Standard', planId: null,
  catalogRegion: null, pendingPlanId: null, pendingAmount: null, amount: 190, currency: 'EGP',
  billingCycle: 'monthly', billingDay: 19, startDate: '2026-01-19', nextBillingDate: null,
  paymentMethodId: null, expenseCategory: 'Subscription', linkedRecurringExpenseId: null,
  status: 'active', notes: null, createdAt: '2026-01-01T00:00:00Z', cancelledAt: null, ...over,
})
const exp = (subId: string, date: string, amount = 190, extra: Partial<Expense> = {}): Expense =>
  ({ id: date + subId, date, amount, currency: 'EGP', amountInBaseCurrency: amount, linkedSubscriptionId: subId, ...extra }) as Expense
const row = (s: Subscription, e: Expense[] = []) => buildRow(s, e, today, 'EGP', { USD_EGP: 53.45 })
const paidSep = (id = 's1') => exp(id, '2026-09-19')

describe('buildRow chips', () => {
  it('shows days until the charge, amber within 3 days', () => {
    expect(row(sub(), [paidSep()]).chip).toMatchObject({ key: 'inDays', n: 2, tone: 'amber' })
    expect(row(sub({ billingDay: 25, startDate: '2026-01-25' }), [exp('s1', '2026-09-25')]).chip).toMatchObject({ key: 'inDays', n: 8, tone: 'neutral' })
  })
  it('shows Today on the due date', () => {
    expect(row(sub({ billingDay: 17, startDate: '2026-01-17' }), [exp('s1', '2026-09-17')]).chip.key).toBe('today')
  })
  it('shows Expected, not seen after the 3-day grace, in the Overdue group', () => {
    const r = row(sub({ billingDay: 14, startDate: '2026-01-14' }), [])
    expect(r.chip.key).toBe('expected')
    expect(r.group).toBe('overdue')
  })
  it('shows paused, ends, trial', () => {
    expect(row(sub({ status: 'paused' })).chip.key).toBe('paused')
    expect(row(sub({ status: 'paused' })).date).toBeNull()
    const c = row(sub({ status: 'cancelled', endsOn: '2026-10-26' }))
    expect(c.chip).toMatchObject({ key: 'ends', date: '2026-10-26' })
    const t = row(sub({ status: 'trial', trialEnd: '2026-10-24' }))
    expect(t.chip.key).toBe('trialEnds')
    expect(t.struck).toBe(true)
  })
  it('shows a price rise with the old price beneath', () => {
    const r = row(sub(), [paidSep(), exp('s1', '2026-09-30', 210)])
    expect(r.chip).toMatchObject({ key: 'price', n: 10.5 })
    expect(r.amount).toBe(210)
    expect(r.note).toEqual({ kind: 'was', amount: 190 })
  })
  it('shows a failed payment when the bank declined this cycle', () => {
    const r = row(sub({ billingDay: 16, startDate: '2026-01-16' }), [exp('s1', '2026-10-16', 190, { refundKind: 'declined' })])
    expect(r.chip.key).toBe('failed')
  })
  it('shows a pending plan change', () => {
    const r = row(sub({ pendingPlanId: 'x', pendingAmount: 109, pendingPlanFrom: '2026-11-02' }), [paidSep()])
    expect(r.chip).toMatchObject({ key: 'planChanges', date: '2026-11-02' })
    expect(r.amount).toBe(109)
    expect(r.note).toEqual({ kind: 'was', amount: 190 })
  })
  it('shows shared with my share of the full price', () => {
    const r = row(sub({ amount: 270, myShare: 135, sharedWith: ['Mona'] }), [exp('s1', '2026-09-19', 135)])
    expect(r.chip).toMatchObject({ key: 'shared', n: 2 })
    expect(r.amount).toBe(135)
    expect(r.note).toEqual({ kind: 'myShare', of: 270 })
  })
  it('shows a USD plan as ≈ EGP with the USD amount beneath', () => {
    const r = row(sub({ amount: 20, currency: 'USD', billingDay: 21, startDate: '2026-01-21' }), [exp('s1', '2026-09-21', 1069)])
    expect(r.approx).toBe(true)
    expect(r.amount).toBeCloseTo(1069, 0)
    expect(r.note).toMatchObject({ kind: 'foreign', amount: 20, currency: 'USD' })
  })
  it('shows a yearly plan with its monthly equivalent', () => {
    const r = row(sub({ amount: 249, billingCycle: 'yearly', billingDay: 2, startDate: '2025-12-02' }), [exp('s1', '2025-12-02', 249)])
    expect(r.chip.key).toBe('yearly')
    expect(r.group).toBe('yearly')
    expect(r.note).toEqual({ kind: 'perMonth', amount: 20.75 })
  })
})

describe('buildHomeLists', () => {
  const rows = [
    row(sub({ id: 'a', billingDay: 14, startDate: '2026-01-14' })),
    row(sub({ id: 'b' }), [paidSep('b')]),
    row(sub({ id: 'c', billingDay: 26, startDate: '2026-01-26' }), [exp('c', '2026-09-26')]),
    row(sub({ id: 'd', billingDay: 2, startDate: '2026-01-02' }), [exp('d', '2026-10-02')]),
    row(sub({ id: 'p', status: 'paused' })),
    row(sub({ id: 'x', status: 'cancelled', endsOn: '2026-10-26' })),
    row(sub({ id: 'e', status: 'cancelled', endsOn: '2026-09-01' })),
  ]
  const toBase = (r: { amount: number }) => r.amount
  it('Upcoming lists the next 30 days, then what was paid this month; cancelled and paused never count there (QA W4)', () => {
    const paidThisMonth = row(sub({ id: 'm', billingDay: 5, startDate: '2026-01-05' }), [exp('m', '2026-10-05')])
    const yearly = row(sub({ id: 'y', billingCycle: 'yearly', billingDay: 1, startDate: '2026-03-01' }), [exp('y', '2026-03-01')])
    const l = buildHomeLists('upcoming', [...rows, paidThisMonth, yearly], toBase, today)
    expect(l.groups.map((g) => [g.key, g.rows.map((r) => r.sub.id)])).toEqual([
      ['next30', ['a', 'b', 'c']], ['paid', ['m', 'd']], ['later', ['y']],
    ])
    expect(l.groups[0].total).toBe(570)
    expect(paidThisMonth.paidOn).toBe('2026-10-05')
    expect(l.activeCount).toBe(6)
    expect(l.groups.flatMap((g) => g.rows).some((r) => r.sub.status === 'cancelled' || r.sub.status === 'paused')).toBe(false)
  })
  it('lists everything under All, and cancelled (still running or over) and paused plans under Ended', () => {
    expect(buildHomeLists('all', rows, toBase, today).groups[0].rows).toHaveLength(7)
    expect(buildHomeLists('ended', rows, toBase, today).groups[0].rows.map((r) => r.sub.id).sort()).toEqual(['e', 'p', 'x'])
  })
})

describe('nudges and rail', () => {
  it('shows one nudge at a time in priority order, and skips dismissed ones', () => {
    const rows = [
      row(sub({ id: 'ask', tracking: 'ask', billingDay: 17, startDate: '2026-01-17' }), []),
      row(sub({ id: 'trial', status: 'trial', trialEnd: '2026-10-18' })),
    ]
    const first = pickNudge(rows, today, new Set())
    expect(first?.kind).toBe('ask')
    const second = pickNudge(rows, today, new Set([first!.key]))
    expect(second?.kind).toBe('trial')
  })
  it('falls back to a monthly still-using nudge', () => {
    expect(pickNudge([row(sub(), [paidSep()])], today, new Set())?.kind).toBe('still')
  })
  it('does not ask "still using it?" about a subscription added today', () => {
    expect(pickNudge([row(sub({ createdAt: '2026-10-17T09:00:00Z' }), [paidSep()])], today, new Set())).toBeNull()
  })
  it('caps rail insights at two, price before trial', () => {
    const rows = [
      row(sub({ id: 'p1' }), [exp('p1', '2026-10-01', 250)]),
      row(sub({ id: 't1', status: 'trial', trialEnd: '2026-10-24' })),
      row(sub({ id: 't2', status: 'trial', trialEnd: '2026-10-25' })),
    ]
    expect(railInsights(rows).map((i) => [i.kind, i.row.sub.id])).toEqual([['price', 'p1'], ['trial', 't1']])
  })
  it('marks 30 days with today first and due days flagged', () => {
    const strip = thirtyDayStrip([row(sub(), [paidSep()])], today)
    expect(strip).toHaveLength(30)
    expect(strip[0].isToday).toBe(true)
    expect(strip.filter((d) => d.due).map((d) => d.date.getDate())).toEqual([19])
  })
})

describe('dates around today (QA, Nov 26)', () => {
  const nov26 = new Date(2026, 10, 26, 12)
  const at = (s: Subscription, e: Expense[] = []) => buildRow(s, e, nov26, 'EGP', {})
  it('a charge on Dec 10 is Later, not This month', () => {
    const r = at(sub({ id: 'v', name: 'Vodafone', billingDay: 10, startDate: '2026-01-10' }), [exp('v', '2026-11-10')])
    expect(r.date).toBe('2026-12-10')
    expect(r.group).toBe('later')
  })
  it('a charge later this month is This month', () => {
    const r = at(sub({ id: 'm', billingDay: 30, startDate: '2026-01-30' }), [exp('m', '2026-10-30')])
    expect(r.group).toBe('week')
    const far = buildRow(sub({ id: 'f', billingDay: 28, startDate: '2026-01-28' }), [exp('f', '2026-10-28')], new Date(2026, 10, 12, 12), 'EGP', {})
    expect(far.group).toBe('month')
  })
  it('an unpaid Nov 18 charge keeps its date for the status, and the next charge rolls to Dec 18', () => {
    const r = at(sub({ billingDay: 18, startDate: '2026-01-18' }), [exp('s1', '2026-10-18')])
    expect(r.cycle?.kind).toBe('overdue')
    expect(r.date).toBe('2026-11-18')
    expect(r.nextDue).toBe('2026-12-18')
  })
  it('a paid cycle’s next charge is its row date', () => {
    const r = at(sub({ billingDay: 18, startDate: '2026-01-18' }), [exp('s1', '2026-11-18')])
    expect(r.nextDue).toBe('2026-12-18')
    expect(r.nextDue).toBe(r.date)
  })
})
