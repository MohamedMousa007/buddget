import { beforeEach, describe, expect, it } from 'vitest'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { refOf } from '@/lib/buddgy/tools/refs'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense, PaymentMethod, Subscription } from '@/lib/store/types'
import { buildRecurringExpenseFromSubscription } from '@/lib/subscriptions/subscriptionRecurring'

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }

const CASH = 'aaaaaaaa-0000-0000-0000-000000000001'
const CARD = 'd4d4d4d4-0000-0000-0000-000000000002'
const S_NET = 'b1b1b1b1-0000-0000-0000-000000000001'
const S_SPOT = 'c2c2c2c2-0000-0000-0000-000000000002'
const RE_NET = '1e1e1e1e-0000-0000-0000-000000000001'
const RE_SPOT = '2e2e2e2e-0000-0000-0000-000000000002'

const pm = (id: string, name: string, isDefault: boolean): PaymentMethod =>
  ({ id, name, type: 'cash', currency: 'EGP', isDefault }) as PaymentMethod

const sub = (id: string, reId: string, over: Partial<Subscription> = {}): Subscription => ({
  id,
  name: 'Netflix',
  brandKey: null,
  planName: null,
  planId: null,
  catalogRegion: null,
  pendingPlanId: null,
  pendingAmount: null,
  amount: 200,
  currency: 'EGP',
  billingCycle: 'monthly',
  billingDay: 5,
  startDate: '2026-01-05',
  nextBillingDate: null,
  paymentMethodId: CASH,
  expenseCategory: 'Enjoyment',
  linkedRecurringExpenseId: reId,
  status: 'active',
  notes: null,
  createdAt: '2026-01-05T10:00:00.000Z',
  cancelledAt: null,
  tracking: 'sms',
  reminder: true,
  ...over,
})

const charge = (id: string, subId: string, date: string, amount = 200): Expense =>
  ({
    id,
    date,
    description: 'Netflix',
    category: 'Subscription',
    amount,
    currency: 'EGP',
    amountInBaseCurrency: amount,
    paymentMethodId: CASH,
    isRecurring: true,
    linkedSubscriptionId: subId,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T10:00:00.000Z`,
  }) as Expense

const seed = (subs: Subscription[]) =>
  useFinanceStore.setState({
    subscriptions: subs,
    recurringExpenses: subs.map((s) => buildRecurringExpenseFromSubscription(s, s.linkedRecurringExpenseId as string, CASH)),
  })

const write = (name: string) => {
  const w = TOOLS.get(name)?.write
  if (!w) throw new Error(`no write tool ${name}`)
  return w
}
const read = (name: string, args: Record<string, unknown> = {}) => {
  const r = TOOLS.get(name)?.read
  if (!r) throw new Error(`no read tool ${name}`)
  return r(args, ctx) as Record<string, unknown>
}
const st = () => useFinanceStore.getState()

function proposeApply(tool: string, args: Record<string, unknown>) {
  const p = write(tool).propose(args, ctx)
  if (!p.ok) throw new Error(`propose failed: ${p.error}`)
  return { proposal: p.proposal, applied: write(tool).apply(p.proposal, ctx) }
}

beforeEach(() => {
  useFinanceStore.setState({
    paymentMethods: [pm(CASH, 'Cash', true), pm(CARD, 'CIB Card', false)],
    expenses: [],
    incomeSources: [],
    exchangeRates: {},
    settings: { ...st().settings, baseCurrency: 'EGP' },
  })
  seed([sub(S_NET, RE_NET)])
})

describe('list_subscriptions', () => {
  it('lists refs, status, next charge, state and the monthly total', () => {
    seed([
      sub(S_NET, RE_NET, { expenseCategory: 'Enjoyment' }),
      sub(S_SPOT, RE_SPOT, { name: 'Spotify', amount: 1200, billingCycle: 'yearly', billingDay: 1, startDate: '2026-03-01', status: 'paused' }),
      sub('3f3f3f3f-0000-0000-0000-000000000003', '3e3e3e3e-0000-0000-0000-000000000003', { name: 'Old', status: 'cancelled', endsOn: '2026-06-01' }),
    ])
    useFinanceStore.setState({ expenses: [charge('e1000000-0000-0000-0000-000000000001', S_NET, '2026-10-06')] })
    const res = read('list_subscriptions') as { monthly: number; yearly: number; count: number; rows: Record<string, unknown>[] }
    expect(res.count).toBe(2)
    expect(res.monthly).toBe(200)
    expect(res.yearly).toBe(2400)
    expect(res.rows[0]).toMatchObject({ ref: refOf(S_NET), name: 'Netflix', price: 200, status: 'active', next: '2026-11-05', monthly: 200 })
    expect(res.rows[1]).toMatchObject({ name: 'Spotify', status: 'paused' })
    expect((read('list_subscriptions', { status: 'ended' }) as { count: number }).count).toBe(1)
  })

  it('flags an unrecorded past charge as overdue', () => {
    const res = read('list_subscriptions') as { rows: Record<string, unknown>[] }
    expect(res.rows[0]).toMatchObject({ next: '2026-10-05', state: 'overdue' })
  })
})

describe('add_subscription', () => {
  const args = { name: 'Gym', amount: 500, cycle: 'monthly', firstCharge: '2026-11-10', category: 'Health' }

  it('creates the subscription with its recurring expense and undoes both', () => {
    const p = write('add_subscription').propose(args, ctx)
    expect(p.ok && p.proposal.summary).toMatch(/^Pending approval/)
    expect(p.ok && p.proposal.preview.effect).toMatch(/Adds .*500.* a month\. Committed becomes .*700/)
    expect(st().subscriptions).toHaveLength(1)
    const { applied } = proposeApply('add_subscription', args)
    expect(applied.ok).toBe(true)
    expect(st().subscriptions).toHaveLength(2)
    expect(st().recurringExpenses).toHaveLength(2)
    const added = st().subscriptions.at(-1)
    expect(added).toMatchObject({ name: 'Gym', amount: 500, currency: 'EGP', billingCycle: 'monthly', billingDay: 10, startDate: '2026-11-10', status: 'active', expenseCategory: 'Health', paymentMethodId: CASH, tracking: 'sms' })
    expect(st().recurringExpenses.find((r) => r.id === added?.linkedRecurringExpenseId)).toMatchObject({ amount: 500, dayOfMonth: 10, isActive: true })
    if (applied.ok) applied.undo?.()
    expect(st().subscriptions).toHaveLength(1)
    expect(st().recurringExpenses).toHaveLength(1)
  })

  it('records a free trial that ends on the given day', () => {
    const p = write('add_subscription').propose({ ...args, trial: true }, ctx)
    expect(p.ok && p.proposal.preview.effect).toMatch(/Free until the trial ends/)
    proposeApply('add_subscription', { ...args, trial: true })
    expect(st().subscriptions.at(-1)).toMatchObject({ status: 'trial', trialEnd: '2026-11-10' })
    expect(write('add_subscription').propose({ name: 'Gym', amount: 5, cycle: 'monthly', trial: true }, ctx).ok).toBe(false)
    expect(write('add_subscription').propose({ ...args, trial: true, firstCharge: '2026-10-01' }, ctx).ok).toBe(false)
  })

  it('links a catalog brand by exact name', () => {
    proposeApply('add_subscription', { name: 'Netflix', amount: 199, cycle: 'monthly' })
    expect(st().subscriptions.at(-1)?.brandKey).toBe('netflix')
  })

  it('rejects bad input without guessing', () => {
    const add = write('add_subscription')
    expect(add.propose({ ...args, amount: 0 }, ctx).ok).toBe(false)
    expect(add.propose({ ...args, cycle: 'daily' }, ctx).ok).toBe(false)
    expect(add.propose({ ...args, currency: 'ZZZ' }, ctx).ok).toBe(false)
    expect(add.propose({ ...args, category: 'Nonsense' }, ctx).ok).toBe(false)
    expect(add.propose({ ...args, firstCharge: '2026-02-31' }, ctx).ok).toBe(false)
    const method = add.propose({ ...args, method: 'Amex' }, ctx)
    expect(method.ok).toBe(false)
    if (!method.ok) expect(method.choices?.map((c) => c.label)).toEqual(['Cash', 'CIB Card'])
  })

  it('warns when a subscription with that name already exists', () => {
    const p = write('add_subscription').propose({ name: 'netflix', amount: 200, cycle: 'monthly' }, ctx)
    expect(p.ok && p.proposal.preview.effect).toMatch(/already track/)
  })

  it('previews in Arabic', () => {
    const p = write('add_subscription').propose(args, { ...ctx, locale: 'ar' })
    expect(p.ok && p.proposal.preview.title).toBe('إضافة اشتراك')
  })
})

describe('update_subscription', () => {
  it('changes the price, records history, patches the recurring expense and undoes', () => {
    const { proposal, applied } = proposeApply('update_subscription', { sub: 'Netflix', amount: 260 })
    expect(proposal.preview.rows).toEqual([{ label: 'Price', before: expect.stringContaining('200'), value: expect.stringContaining('260') }])
    expect(applied.ok).toBe(true)
    expect(st().subscriptions[0]).toMatchObject({ amount: 260 })
    expect(st().subscriptions[0].priceHistory?.map((h) => h.amount)).toEqual([200, 260])
    expect(st().recurringExpenses[0].amount).toBe(260)
    if (applied.ok) applied.undo?.()
    expect(st().subscriptions[0].amount).toBe(200)
    expect(st().recurringExpenses[0].amount).toBe(200)
    expect(st().subscriptions[0].updatedAt).toBeTruthy()
  })

  it('moves the billing day and the cycle', () => {
    proposeApply('update_subscription', { sub: refOf(S_NET), billingDay: 20, cycle: 'quarterly' })
    expect(st().subscriptions[0]).toMatchObject({ billingDay: 20, billingCycle: 'quarterly' })
    expect(st().recurringExpenses[0].dayOfMonth).toBe(20)
  })

  it('fails on no-ops, bad values and a new currency without a price', () => {
    const upd = write('update_subscription')
    expect(upd.propose({ sub: refOf(S_NET), amount: 200 }, ctx).ok).toBe(false)
    expect(upd.propose({ sub: refOf(S_NET), billingDay: 32 }, ctx).ok).toBe(false)
    expect(upd.propose({ sub: refOf(S_NET), currency: 'USD' }, ctx).ok).toBe(false)
    expect(upd.propose({ sub: 'zzzzzz', amount: 5 }, ctx).ok).toBe(false)
  })

  it('refuses to edit an ended subscription', () => {
    seed([sub(S_NET, RE_NET, { status: 'cancelled', endsOn: '2026-06-01' })])
    expect(write('update_subscription').propose({ sub: refOf(S_NET), amount: 5 }, ctx).ok).toBe(false)
  })

  it('asks which one when two share a name', () => {
    seed([sub(S_NET, RE_NET), sub(S_SPOT, RE_SPOT)])
    const r = write('update_subscription').propose({ sub: 'Netflix', amount: 5 }, ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.choices).toHaveLength(2)
  })
})

describe('pause_subscription / resume_subscription', () => {
  it('pauses, stops the recurring expense, resumes and undoes', () => {
    const paused = proposeApply('pause_subscription', { sub: refOf(S_NET) })
    expect(st().subscriptions[0].status).toBe('paused')
    expect(st().recurringExpenses[0].isActive).toBe(false)
    if (paused.applied.ok) paused.applied.undo?.()
    expect(st().subscriptions[0].status).toBe('active')
    expect(st().recurringExpenses[0].isActive).toBe(true)

    proposeApply('pause_subscription', { sub: refOf(S_NET) })
    const resumed = proposeApply('resume_subscription', { sub: refOf(S_NET) })
    expect(st().subscriptions[0]).toMatchObject({ status: 'active', pausedAt: null })
    expect(st().recurringExpenses[0].isActive).toBe(true)
    if (resumed.applied.ok) resumed.applied.undo?.()
    expect(st().subscriptions[0].status).toBe('paused')
  })

  it('refuses to pause what is not active and to resume what is already active', () => {
    expect(write('resume_subscription').propose({ sub: refOf(S_NET) }, ctx).ok).toBe(false)
    seed([sub(S_NET, RE_NET, { status: 'paused' })])
    expect(write('pause_subscription').propose({ sub: refOf(S_NET) }, ctx).ok).toBe(false)
  })

  it('re-subscribes a cancelled subscription', () => {
    seed([sub(S_NET, RE_NET, { status: 'cancelled', endsOn: '2026-06-01', cancelledAt: '2026-05-01T00:00:00.000Z' })])
    const p = write('resume_subscription').propose({ sub: refOf(S_NET) }, ctx)
    expect(p.ok && p.proposal.preview.title).toMatch(/^Re-subscribe/)
    const { applied } = proposeApply('resume_subscription', { sub: refOf(S_NET) })
    expect(st().subscriptions[0]).toMatchObject({ status: 'active', endsOn: null, cancelledAt: null })
    expect(st().recurringExpenses[0].isActive).toBe(true)
    if (applied.ok) applied.undo?.()
    expect(st().subscriptions[0]).toMatchObject({ status: 'cancelled', endsOn: '2026-06-01' })
    expect(st().recurringExpenses[0].isActive).toBe(false)
  })
})

describe('cancel_subscription', () => {
  it('defaults to the end of the paid cycle, warns to cancel with the service, and undoes', () => {
    seed([sub(S_NET, RE_NET, { brandKey: 'netflix' })])
    useFinanceStore.setState({ expenses: [charge('e1000000-0000-0000-0000-000000000001', S_NET, '2026-10-06')] })
    const p = write('cancel_subscription').propose({ sub: 'Netflix' }, ctx)
    expect(p.ok && p.proposal.args.endsOn).toBe('2026-11-04')
    expect(p.ok && p.proposal.preview.effect).toMatch(/cancel with Netflix yourself/)
    expect(p.ok && p.proposal.preview.rows.some((r) => r.label === 'How to cancel')).toBe(true)
    const { applied } = proposeApply('cancel_subscription', { sub: 'Netflix' })
    expect(st().subscriptions[0]).toMatchObject({ status: 'cancelled', endsOn: '2026-11-04' })
    expect(st().recurringExpenses[0].isActive).toBe(true)
    if (applied.ok) applied.undo?.()
    expect(st().subscriptions[0]).toMatchObject({ status: 'active' })
    expect(st().recurringExpenses[0].isActive).toBe(true)
  })

  it('ends today when the open cycle is unpaid, and accepts an explicit date', () => {
    expect(write('cancel_subscription').propose({ sub: refOf(S_NET) }, ctx)).toMatchObject({ ok: true, proposal: { args: { endsOn: '2026-10-19' } } })
    expect(write('cancel_subscription').propose({ sub: refOf(S_NET), endsOn: '2026-12-31' }, ctx)).toMatchObject({ ok: true, proposal: { args: { endsOn: '2026-12-31' } } })
    expect(write('cancel_subscription').propose({ sub: refOf(S_NET), endsOn: 'soon' }, ctx).ok).toBe(false)
  })

  it('refuses an already cancelled subscription', () => {
    seed([sub(S_NET, RE_NET, { status: 'cancelled', endsOn: '2026-12-01' })])
    expect(write('cancel_subscription').propose({ sub: refOf(S_NET) }, ctx).ok).toBe(false)
  })
})

describe('mark_subscription_paid', () => {
  it('records the charge once per cycle and undoes', () => {
    const { applied } = proposeApply('mark_subscription_paid', { sub: refOf(S_NET) })
    expect(applied.ok).toBe(true)
    expect(st().expenses).toHaveLength(1)
    expect(st().expenses[0]).toMatchObject({ category: 'Subscription', linkedSubscriptionId: S_NET, amount: 200, currency: 'EGP', paymentMethodId: CASH, isRecurring: true, date: '2026-10-19' })
    expect(write('mark_subscription_paid').propose({ sub: refOf(S_NET) }, ctx).ok).toBe(false)
    if (applied.ok) applied.undo?.()
    expect(st().expenses).toHaveLength(0)
    expect(write('mark_subscription_paid').propose({ sub: refOf(S_NET) }, ctx).ok).toBe(true)
  })

  it('does nothing when the next charge is far away', () => {
    useFinanceStore.setState({ expenses: [charge('e1000000-0000-0000-0000-000000000001', S_NET, '2026-10-06')] })
    expect(write('mark_subscription_paid').propose({ sub: refOf(S_NET) }, ctx).ok).toBe(false)
  })

  it('rejects a stale proposal when the cycle was recorded meanwhile', () => {
    const p = write('mark_subscription_paid').propose({ sub: refOf(S_NET) }, ctx)
    if (!p.ok) throw new Error('expected ok')
    useFinanceStore.setState({ expenses: [charge('e1000000-0000-0000-0000-000000000001', S_NET, '2026-10-12')] })
    expect(write('mark_subscription_paid').apply(p.proposal, ctx).ok).toBe(false)
    expect(st().expenses).toHaveLength(1)
  })

  it('only works for an active subscription', () => {
    seed([sub(S_NET, RE_NET, { status: 'paused' })])
    expect(write('mark_subscription_paid').propose({ sub: refOf(S_NET) }, ctx).ok).toBe(false)
  })
})

describe('adopt_subscription_price', () => {
  it('adopts the price from the latest charge and undoes', () => {
    useFinanceStore.setState({ expenses: [charge('e1000000-0000-0000-0000-000000000001', S_NET, '2026-10-06', 260)] })
    const p = write('adopt_subscription_price').propose({ sub: refOf(S_NET) }, ctx)
    expect(p.ok && p.proposal.preview.rows[0]).toMatchObject({ before: expect.stringContaining('200'), value: expect.stringContaining('260') })
    const { applied } = proposeApply('adopt_subscription_price', { sub: refOf(S_NET) })
    expect(st().subscriptions[0].amount).toBe(260)
    expect(st().subscriptions[0].priceHistory?.map((h) => h.amount)).toEqual([200, 260])
    expect(st().recurringExpenses[0].amount).toBe(260)
    if (applied.ok) applied.undo?.()
    expect(st().subscriptions[0].amount).toBe(200)
  })

  it('fails when no price change was detected', () => {
    useFinanceStore.setState({ expenses: [charge('e1000000-0000-0000-0000-000000000001', S_NET, '2026-10-06', 200)] })
    expect(write('adopt_subscription_price').propose({ sub: refOf(S_NET) }, ctx).ok).toBe(false)
  })
})

describe('delete_subscription', () => {
  it('is strong, removes the recurring expense, keeps recorded charges and undo restores both', () => {
    useFinanceStore.setState({ expenses: [charge('e1000000-0000-0000-0000-000000000001', S_NET, '2026-10-06')] })
    const p = write('delete_subscription').propose({ sub: refOf(S_NET) }, ctx)
    expect(p.ok && p.proposal.risk).toBe('strong')
    expect(p.ok && p.proposal.preview.effect).toMatch(/recurring expense is removed. 1 recorded charge stay/)
    if (!p.ok) return
    const before = structuredClone({ subscriptions: st().subscriptions, recurringExpenses: st().recurringExpenses, expenses: st().expenses })
    const applied = write('delete_subscription').apply(p.proposal, ctx)
    expect(st().subscriptions).toHaveLength(0)
    expect(st().recurringExpenses).toHaveLength(0)
    expect(st().expenses).toHaveLength(1)
    expect(applied.ok && typeof applied.undo).toBe('function')
    if (applied.ok) applied.undo?.()
    expect({ subscriptions: st().subscriptions, recurringExpenses: st().recurringExpenses, expenses: st().expenses }).toEqual(before)
  })

  it('rejects a stale apply and an unknown ref', () => {
    expect(write('delete_subscription').propose({ sub: 'zzzzzz' }, ctx).ok).toBe(false)
    const p = write('delete_subscription').propose({ sub: refOf(S_NET) }, ctx)
    if (!p.ok) throw new Error('expected ok')
    useFinanceStore.getState().deleteSubscription(S_NET)
    expect(write('delete_subscription').apply(p.proposal, ctx).ok).toBe(false)
  })
})
