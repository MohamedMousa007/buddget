import { describe, expect, it } from 'vitest'
import type { Debt, Expense, Goal, IncomeSource, Subscription } from '@/lib/store/types'
import {
  debtExtras, debtKind, goalExtras, debtPaidByDebt, goalMonthlyDraw, liveDebts, monthlyFromFrequency, paydayDayOf,
  savingGoals, subscriptionsExtras, subscriptionsLive, type DebtLiveCtx,
} from '@/lib/budget/liveLinks'

const NOW = new Date(2026, 9, 19)
const ctx = (debtPayments: DebtLiveCtx['debtPayments'] = []): DebtLiveCtx => ({
  debtPayments, expenses: [], base: 'AED', rates: {}, goldPricePerGram: 0, goldPriceAvailable: false,
})
const debt = (o: Partial<Debt>): Debt => ({ id: 'd', name: 'D', person: '', startingBalance: 1200, currency: 'AED', isGold: false, createdAt: '', ...o })
const sub = (o: Partial<Subscription>): Subscription =>
  ({ id: 's', name: 'Netflix', brandKey: 'netflix', amount: 60, currency: 'AED', billingCycle: 'monthly', billingDay: 5, startDate: '2026-01-05', createdAt: '2026-01-05T00:00:00Z', status: 'active', ...o }) as Subscription

describe('monthlyFromFrequency', () => {
  it('normalises every cadence to a month', () => {
    expect(monthlyFromFrequency(120, 'monthly')).toBe(120)
    expect(monthlyFromFrequency(300, 'quarterly')).toBe(100)
    expect(monthlyFromFrequency(1200, 'annually')).toBe(100)
    expect(monthlyFromFrequency(12, 'weekly')).toBeCloseTo(52)
  })
})

describe('subscriptions', () => {
  it('lists charging subscriptions at their monthly equivalent', () => {
    const live = subscriptionsLive([sub({}), sub({ id: 'y', name: 'iCloud', billingCycle: 'yearly', amount: 120 }), sub({ id: 'p', status: 'paused' })], 'AED', {}, NOW)
    expect(live.monthly).toBe(70)
    expect(live.items.map((i) => [i.name, i.amount, i.brandKey])).toEqual([['Netflix', 60, 'netflix'], ['iCloud', 10, 'netflix']])
  })

  const extrasInput = (cycleExpenses: Expense[] = [], today = NOW) => ({
    subs: [sub({}), sub({ id: 'y', name: 'iCloud', billingCycle: 'yearly', amount: 120, billingDay: 28, startDate: '2025-10-28' })],
    cycleExpenses, today, cycleStart: new Date(2026, 9, 1), cycleEnd: new Date(2026, 9, 31), base: 'AED' as const, rates: {},
  })

  it('splits posted charges from the ones still to come; yearly plans are set aside', () => {
    const paid = { id: 'e', date: '2026-10-05', amount: 60, currency: 'AED', linkedSubscriptionId: 's' } as Expense
    const x = subscriptionsExtras(extrasInput([paid]))
    expect(x.charged).toBe(60)
    expect(x.left).toEqual([])
    expect(x.yearlySetAside).toBe(10)
    expect(x.total).toBe(60)
  })

  it('lists a charge still due this cycle and names the next one', () => {
    const x = subscriptionsExtras(extrasInput([], new Date(2026, 9, 1)))
    expect(x.left).toEqual([{ name: 'Netflix', date: '2026-10-05', amount: 60 }])
    expect(x.next).toEqual({ name: 'Netflix', date: '2026-10-05', amount: 60 })
    expect(x.total).toBe(60)
  })

  it('has nothing to come for a cycle that is not the current one', () => {
    const x = subscriptionsExtras({ ...extrasInput(), cycleStart: new Date(2026, 8, 1), cycleEnd: new Date(2026, 8, 30) })
    expect(x.left).toEqual([])
    expect(x.next).toBeNull()
  })
})

describe('debts', () => {
  it('classifies kinds', () => {
    expect(debtKind(debt({ debtType: 'credit_card' }))).toBe('credit_card')
    expect(debtKind(debt({ debtType: 'installment' }))).toBe('installment')
    expect(debtKind(debt({ debtType: 'general', installmentCount: 6 }))).toBe('installment')
    expect(debtKind(debt({ debtType: 'general' }))).toBe('personal')
    expect(debtKind(debt({}))).toBe('personal')
  })

  it('skips cleared, owed-to-me and fully paid debts', () => {
    const c = ctx([{ id: 'p', debtId: 'paid', date: '2026-01-01', amountPaid: 1200, createdAt: '' }])
    const out = liveDebts([debt({ id: 'a' }), debt({ id: 'b', status: 'cleared' }), debt({ id: 'c', direction: 'they_owe' }), debt({ id: 'paid' })], c)
    expect(out.map((d) => d.debt.id)).toEqual(['a'])
  })

  it('converts a foreign-currency debt and its minimum to base', () => {
    const [d] = liveDebts([debt({ currency: 'USD', startingBalance: 100, debtType: 'installment', installmentAmount: 10 })], ctx())
    expect(d.balance).toBeCloseTo(367.25)
    expect(d.minimum).toBeCloseTo(36.725)
  })

  it('sums payments inside the cycle per debt, in base', () => {
    const payments = [
      { id: '1', debtId: 'a', date: '2026-10-03', amountPaid: 100, createdAt: '' },
      { id: '2', debtId: 'a', date: '2026-09-30', amountPaid: 999, createdAt: '' },
      { id: '3', debtId: 'b', date: '2026-10-15T08:00:00Z', amountPaid: 10, createdAt: '' },
    ]
    const paid = debtPaidByDebt([debt({ id: 'a' }), debt({ id: 'b', currency: 'USD' })], ctx(payments), '2026-10', 1)
    expect(paid.a).toBe(100)
    expect(paid.b).toBeCloseTo(36.725)
  })

  it('builds the card for the page', () => {
    const c = ctx([{ id: '1', debtId: 'a', date: '2026-10-03', amountPaid: 300, createdAt: '' }, { id: '2', debtId: 'a', date: '2026-09-03', amountPaid: 300, createdAt: '' }])
    const [live] = liveDebts([debt({ id: 'a', debtType: 'installment', installmentAmount: 300, installmentCount: 4 })], c)
    expect(debtExtras(live, 300, c)).toMatchObject({
      id: 'a', kind: 'installment', balance: 600, paidPercent: 50, minimum: 300, installment: { done: 2, total: 4 }, paidThisCycle: true, apr: null,
    })
    expect(debtExtras(live, 0, c).paidThisCycle).toBe(false)
  })

  it('a credit card shows no progress bar', () => {
    const c = ctx()
    const [live] = liveDebts([debt({ debtType: 'credit_card', startingBalance: 2000 })], c)
    expect(debtExtras(live, 0, c)).toMatchObject({ paidPercent: 0, installment: null, minimum: 100 })
  })
})

describe('goals', () => {
  const goal = (o: Partial<Goal>): Goal => ({ fundingMode: 'manual', monthlyContribution: null, sharePct: null, frequency: 'monthly', status: 'active', category: 'house', priority: 1, ...o }) as Goal

  it('draws by funding mode', () => {
    expect(goalMonthlyDraw(goal({ fundingMode: 'fixed', monthlyContribution: 300 }), null)).toBe(300)
    expect(goalMonthlyDraw(goal({ fundingMode: 'fixed', monthlyContribution: 300, frequency: 'quarterly' }), null)).toBe(100)
    expect(goalMonthlyDraw(goal({ fundingMode: 'share', sharePct: 25 }), 2000)).toBe(500)
    expect(goalMonthlyDraw(goal({ fundingMode: 'share', sharePct: 25 }), null)).toBe(0)
    expect(goalMonthlyDraw(goal({}), 2000)).toBe(0)
  })

  it('keeps active saving goals in priority order', () => {
    const out = savingGoals([goal({ id: 'b', priority: 2 }), goal({ id: 'a', priority: 1 }), goal({ id: 'x', status: 'achieved' }), goal({ id: 'l', category: 'spending_control' })])
    expect(out.map((g) => g.id)).toEqual(['a', 'b'])
  })
})

describe('goalExtras', () => {
  it('converts to base, plans the draw and orders by priority', () => {
    const status = { kind: 'next', icon: 'Flag', tone: 'ink', button: { action: 'addMoney', variant: 'outline' }, params: {} } as const
    const g = (o: Partial<Goal>) => ({ name: 'G', emoji: '', category: 'car', currency: 'USD', targetAmount: 1000, targetDate: '2027-01-01', status: 'active', fundingMode: 'fixed', monthlyContribution: 50, frequency: 'monthly', priority: 1, ...o }) as Goal
    const rows = [
      { goal: g({ id: 'b', priority: 2 }), current: 200, percent: 20, status },
      { goal: g({ id: 'a', targetAmount: null }), current: 10, percent: 0, status },
      { goal: g({ id: 'l', category: 'spending_control' }), current: 1, percent: 0, status },
    ]
    const out = goalExtras(rows, null, 'AED', {})
    expect(out.map((x) => x.id)).toEqual(['a', 'b'])
    expect(out[0]).toMatchObject({ icon: 'car', target: null, current: 10 * 3.6725, monthly: 50 })
    expect(out[1]).toMatchObject({ target: 3672.5, current: 734.5, percent: 20, targetDate: '2027-01-01' })
  })
})

describe('paydayDayOf', () => {
  const src = (o: Partial<IncomeSource>): IncomeSource =>
    ({ id: 's', name: 'S', amount: 100, currency: 'AED', isRecurring: true, recurringFrequency: 'monthly', dayOfMonth: 25, effectiveStart: '2026-01-01', createdAt: '', updatedAt: '', ...o }) as IncomeSource

  it('is the first payday of the largest running recurring source', () => {
    expect(paydayDayOf([src({ amount: 50, dayOfMonth: 3 }), src({ id: 'b', amount: 900, paydayDays: [28, 12] })], NOW)).toBe(12)
  })

  it('ignores ended and one-time sources, and is null with none', () => {
    expect(paydayDayOf([src({ effectiveEnd: '2026-01-31' }), src({ id: 'o', isRecurring: false })], NOW)).toBeNull()
    expect(paydayDayOf([], NOW)).toBeNull()
  })
})
