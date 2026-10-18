import { describe, expect, it } from 'vitest'
import type { Expense, Subscription } from '@/lib/store/types'
import { en } from '@/lib/i18n/dictionaries/en'
import { evaluateSubscriptionAlerts, renderSubscriptionAlert } from '../evaluateSubscriptionAlerts'

const today = new Date('2026-10-17T09:00:00')
const sub = (over: Partial<Subscription> = {}): Subscription => ({
  id: 's1', name: 'Netflix', brandKey: 'netflix', planName: 'Standard', planId: null,
  catalogRegion: null, pendingPlanId: null, pendingAmount: null, amount: 190, currency: 'EGP',
  billingCycle: 'monthly', billingDay: 19, startDate: '2026-01-19', nextBillingDate: null,
  paymentMethodId: null, expenseCategory: 'Subscription', linkedRecurringExpenseId: null,
  status: 'active', notes: null, createdAt: '2026-01-01T00:00:00Z', cancelledAt: null, reminder: true, ...over,
})
const paid = (date: string, amount = 190): Expense =>
  ({ id: date, date, amount, currency: 'EGP', amountInBaseCurrency: amount, linkedSubscriptionId: 's1' }) as Expense
const run = (subs: Subscription[], expenses: Expense[] = [], o = {}) =>
  evaluateSubscriptionAlerts({ today, subscriptions: subs, expenses, dueReminders: true, priceAlerts: true, ...o })

describe('evaluateSubscriptionAlerts', () => {
  it('sends one digest for charges due in 3 days or today', () => {
    const [d] = run([sub({ billingDay: 20, startDate: '2026-01-20' }), sub({ id: 's2', name: 'Spotify', billingDay: 17, startDate: '2026-01-17' }), sub({ id: 's3', name: 'Later', billingDay: 25, startDate: '2026-01-25' })], [paid('2026-09-20'), { ...paid('2026-09-20'), linkedSubscriptionId: 's3' } as Expense])
    expect(d.type).toBe('subscription_digest')
    expect(d.type === 'subscription_digest' && d.items.map((i) => i.name)).toEqual(['Spotify', 'Netflix'])
    expect(d.dedupeKey).toBe('sub_digest:2026-10-17')
  })
  it('uses a 7 day lead for a yearly plan', () => {
    const y = sub({ billingCycle: 'yearly', startDate: '2025-10-24', billingDay: 24 })
    expect(run([y], [paid('2025-10-24')]).map((a) => a.type)).toEqual(['subscription_digest'])
  })
  it('stays quiet for paused, cancelled, paid and reminder-off subscriptions', () => {
    const due = { billingDay: 20, startDate: '2026-01-20' }
    expect(run([sub({ ...due, status: 'paused' }), sub({ ...due, id: 'c', status: 'cancelled', endsOn: '2026-10-01' }), sub({ ...due, id: 'r', reminder: false })], [])).toEqual([])
  })
  it('alerts a trial 2 days before and on its last day, and respects the alerts switch', () => {
    const t = (d: string) => sub({ status: 'trial', trialEnd: d, name: 'Shahid VIP', startDate: d })
    expect(run([t('2026-10-19')])[0]).toMatchObject({ type: 'subscription_trial', daysLeft: 2 })
    expect(run([t('2026-10-17')])[0]).toMatchObject({ daysLeft: 0 })
    expect(run([t('2026-10-20')])).toEqual([])
    expect(run([t('2026-10-19')], [], { priceAlerts: false })).toEqual([])
  })
  it('flags a price rise once per new price', () => {
    const a = run([sub({ billingDay: 29, startDate: '2026-01-29' })], [paid('2026-09-29', 210)]).find((x) => x.type === 'subscription_price')
    expect(a).toMatchObject({ from: 190, to: 210, dedupeKey: 'sub_price:s1:210' })
  })
  it('renders localized copy', () => {
    const [d] = run([sub({ billingDay: 20, startDate: '2026-01-20' })], [paid('2026-09-20')])
    expect(renderSubscriptionAlert(en, d)).toEqual({ title: '1 subscription due soon', body: 'Netflix 190.00 in 3 days' })
  })
})
