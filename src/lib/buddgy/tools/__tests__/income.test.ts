import { beforeEach, describe, expect, it } from 'vitest'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { refOf } from '@/lib/buddgy/tools/refs'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import type { IncomeEvent, IncomeSource, PaymentMethod } from '@/lib/store/types'

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }

const write = (name: string) => {
  const w = TOOLS.get(name)?.write
  if (!w) throw new Error(`no write tool ${name}`)
  return w
}
const read = (name: string, args: Record<string, unknown> = {}) => {
  const r = TOOLS.get(name)?.read
  if (!r) throw new Error(`no read tool ${name}`)
  return r(args, ctx) as Res
}

type Row = Record<string, unknown> & { ref: string; status: string; paydays: Row[]; days: number[] }
type Res = { sources: Row[]; oneTime: unknown[] }

const PM_CASH = 'dddddddd-0000-0000-0000-000000000001'
const PM_CARD = 'eeeeeeee-0000-0000-0000-000000000002'
const SALARY = 'a1a1a1a1-0000-0000-0000-000000000001'
const FREELANCE = 'b2b2b2b2-0000-0000-0000-000000000002'
const LATER = 'c3c3c3c3-0000-0000-0000-000000000003'

const pm = (id: string, name: string, isDefault: boolean): PaymentMethod => ({ id, name, type: 'cash', currency: 'EGP', isDefault }) as PaymentMethod

const source = (id: string, over: Partial<IncomeSource>): IncomeSource => ({
  id,
  name: 'Salary',
  amount: 20000,
  currency: 'EGP',
  isRecurring: true,
  recurringFrequency: 'monthly',
  dayOfMonth: 15,
  effectiveStart: '2026-01-01',
  sourceType: 'salary',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
})

const state = () => useFinanceStore.getState()

beforeEach(() => {
  useSettingsStore.setState({ monthFilter: '2026-10' })
  useFinanceStore.setState({
    paymentMethods: [pm(PM_CASH, 'Cash', true), pm(PM_CARD, 'CIB Card', false)],
    incomeSources: [
      source(SALARY, {}),
      source(FREELANCE, { name: 'Freelance', amount: 3000, recurringFrequency: 'biweekly', dayOfMonth: 5, paydayDays: [5, 20] }),
      source(LATER, { name: 'Rent out', amount: 5000, dayOfMonth: 22, recurringFrequency: 'biweekly', paydayDays: [22, 27] }),
    ],
    incomeEvents: [],
    debts: [],
    exchangeRates: {},
    settings: { ...state().settings, baseCurrency: 'EGP', monthStartDay: 1, noIncomeDeclared: false },
  })
})

describe('list_income', () => {
  it('returns refs, schedule and this cycle\'s payday statuses', () => {
    const res = read('list_income')
    const salary = res.sources.find((s: Row) => s.ref === refOf(SALARY))!
    expect(salary).toMatchObject({ name: 'Salary', amount: 20000, freq: 'monthly', active: true })
    expect(salary.paydays).toEqual([{ date: '2026-10-15', status: 'late', amount: 20000 }])
    const freelance = res.sources.find((s: Row) => s.ref === refOf(FREELANCE))!
    expect(freelance.days).toEqual([5, 20])
    expect(freelance.paydays.map((p: Row) => p.status)).toEqual(['missed', 'awaiting'])
  })

  it('lists one-time income of the cycle and no secrets', () => {
    useFinanceStore.setState({
      incomeEvents: [{ id: 'f4f4f4f4-0', name: 'Gift', amount: 500, currency: 'EGP', receivedDate: '2026-10-03', status: 'confirmed', createdAt: '', updatedAt: '' } as IncomeEvent],
    })
    expect(read('list_income').oneTime).toEqual([{ name: 'Gift', amount: 500, cur: 'EGP', date: '2026-10-03' }])
  })
})

describe('add_income', () => {
  it('adds a monthly source on apply, not on propose, and undoes it', () => {
    useFinanceStore.setState({ incomeSources: [], settings: { ...state().settings, noIncomeDeclared: true } })
    const add = write('add_income')
    const p = add.propose({ name: 'Job', amount: 15000, frequency: 'monthly', paydayDays: [1] }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.summary).toMatch(/pending/i)
    expect(p.proposal.risk).toBe('approve')
    expect(state().incomeSources).toHaveLength(0)

    const applied = add.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    const [created] = state().incomeSources
    expect(created).toMatchObject({ name: 'Job', amount: 15000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly', dayOfMonth: 1, paydayDriftDays: 7, sourceType: 'salary', paymentMethodId: PM_CASH })
    expect(created.paydayDays).toBeUndefined()
    expect(state().settings.noIncomeDeclared).toBe(false)

    if (applied.ok) applied.undo?.()
    expect(state().incomeSources).toHaveLength(0)
    expect(state().settings.noIncomeDeclared).toBe(true)
  })

  it('undoing the last-source delete restores the source and the noIncomeDeclared flag', () => {
    const only = source(SALARY, {})
    useFinanceStore.setState({ incomeSources: [only], settings: { ...state().settings, noIncomeDeclared: false } })
    const del = write('delete_income')
    const p = del.propose({ ref: refOf(SALARY) }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = del.apply(p.proposal, ctx)
    if (!applied.ok) throw new Error('apply failed')
    applied.undo?.()
    expect(state().incomeSources).toEqual([only])
    expect(state().settings.noIncomeDeclared).toBe(false)
  })

  it('fills a biweekly schedule from one day and says so', () => {
    const p = write('add_income').propose({ name: 'Job', amount: 4000, frequency: 'biweekly', paydayDays: [5] }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.args.paydayDays).toEqual([5, 20])
    expect(p.proposal.preview.effect).toBeTruthy()
    write('add_income').apply(p.proposal, ctx)
    expect(state().incomeSources.at(-1)).toMatchObject({ recurringFrequency: 'biweekly', paydayDays: [5, 20], dayOfMonth: 5 })
  })

  it('refuses to guess payday days and rejects impossible ones', () => {
    const add = write('add_income')
    expect(add.propose({ name: 'Job', amount: 1, frequency: 'monthly' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'Job', amount: 1, frequency: 'monthly', paydayDays: [1, 15] }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'Job', amount: 1, frequency: 'monthly', paydayDays: [32] }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'Job', amount: 1, frequency: 'weekly', paydayDays: [1, 8, 15, 22, 29] }, ctx).ok).toBe(false)
  })

  it('validates amount, currency and frequency', () => {
    const add = write('add_income')
    expect(add.propose({ name: 'x', amount: 0, frequency: 'one_time' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'x', amount: 5, frequency: 'yearly' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'x', amount: 5, frequency: 'one_time', currency: 'KWD' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'x', amount: 5, frequency: 'one_time', currency: 'ZZZ' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'x', amount: 5, frequency: 'one_time', date: '2026-02-31' }, ctx).ok).toBe(false)
  })

  it('accepts a foreign currency once a rate exists', () => {
    useFinanceStore.setState({ exchangeRates: { KWD_EGP: 160 } })
    const p = write('add_income').propose({ name: 'x', amount: 5, frequency: 'one_time', currency: 'KWD' }, ctx)
    expect(p.ok).toBe(true)
  })

  it('records one-time money as a confirmed event and undoes it', () => {
    const add = write('add_income')
    const p = add.propose({ name: 'Bonus', amount: 2500, frequency: 'one_time', type: 'bonus', date: '2026-10-18', method: 'cib card' }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    const applied = add.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(state().incomeEvents).toHaveLength(1)
    expect(state().incomeEvents[0]).toMatchObject({ name: 'Bonus', amount: 2500, receivedDate: '2026-10-18', status: 'confirmed', sourceType: 'bonus', paymentMethodId: PM_CARD })
    expect(state().incomeEvents[0].templateId).toBeUndefined()
    if (applied.ok) applied.undo?.()
    expect(state().incomeEvents).toHaveLength(0)
  })

  it('defaults to today and warns about a duplicate', () => {
    const add = write('add_income')
    const first = add.propose({ name: 'Bonus', amount: 10, frequency: 'one_time' }, ctx)
    expect(first.ok && first.proposal.args.date).toBe('2026-10-19')
    if (!first.ok) return
    add.apply(first.proposal, ctx)
    const again = add.propose({ name: 'bonus', amount: 10, frequency: 'one_time' }, ctx)
    expect(again.ok && again.proposal.preview.effect).toBeTruthy()
  })

  it('returns choices instead of using the default for an unknown method', () => {
    const r = write('add_income').propose({ name: 'x', amount: 5, frequency: 'one_time', method: 'Amex' }, ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.choices?.map((c) => c.label)).toEqual(['Cash', 'CIB Card'])
  })

  it('rejects day or date fields on the wrong kind', () => {
    const add = write('add_income')
    expect(add.propose({ name: 'x', amount: 5, frequency: 'monthly', paydayDays: [1], date: '2026-10-01' }, ctx).ok).toBe(false)
    expect(add.propose({ name: 'x', amount: 5, frequency: 'one_time', paydayDays: [1] }, ctx).ok).toBe(false)
  })

  it('localizes the preview to Arabic', () => {
    const p = write('add_income').propose({ name: 'x', amount: 5, frequency: 'one_time' }, { ...ctx, locale: 'ar' })
    expect(p.ok && p.proposal.preview.title).toBe('إضافة دخل')
  })
})

describe('update_income', () => {
  it('changes amount and schedule, then undoes', () => {
    const upd = write('update_income')
    const p = upd.propose({ ref: refOf(SALARY), amount: 22000, frequency: 'biweekly' }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.preview.rows.map((r) => r.label)).toEqual(['Amount', 'Frequency', 'Paydays (day of month)'])
    const applied = upd.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(state().incomeSources.find((i) => i.id === SALARY)).toMatchObject({ amount: 22000, recurringFrequency: 'biweekly', dayOfMonth: 15, paydayDays: [15, 30] })
    if (applied.ok) applied.undo?.()
    const back = state().incomeSources.find((i) => i.id === SALARY)
    expect(back).toMatchObject({ amount: 20000, recurringFrequency: 'monthly', dayOfMonth: 15 })
    expect(back?.paydayDays).toBeUndefined()
  })

  it('finds a source by exact name and fails on unknown, ambiguous and no-op', () => {
    const upd = write('update_income')
    expect(upd.propose({ ref: 'freelance', amount: 3500 }, ctx).ok).toBe(true)
    expect(upd.propose({ ref: 'free', amount: 3500 }, ctx).ok).toBe(false)
    expect(upd.propose({ ref: refOf(SALARY), amount: 20000 }, ctx).ok).toBe(false)
    useFinanceStore.setState({ incomeSources: [source(SALARY, {}), source(FREELANCE, { name: 'salary' })] })
    const dup = upd.propose({ ref: 'Salary', amount: 1 }, ctx)
    expect(dup.ok).toBe(false)
    if (!dup.ok) expect(dup.choices).toHaveLength(2)
  })

  it('refuses a type change on a debt-linked source and a schedule change on one-time income', () => {
    useFinanceStore.setState({ incomeSources: [source(SALARY, { linkedDebtId: 'd1', sourceType: 'debt' }), source(FREELANCE, { name: 'Old', isRecurring: false })] })
    const upd = write('update_income')
    expect(upd.propose({ ref: refOf(SALARY), type: 'salary' }, ctx).ok).toBe(false)
    expect(upd.propose({ ref: refOf(FREELANCE), frequency: 'weekly' }, ctx).ok).toBe(false)
  })

  it('rejects a proposal whose source was deleted meanwhile', () => {
    const upd = write('update_income')
    const p = upd.propose({ ref: refOf(SALARY), amount: 1 }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    state().deleteIncomeSource(SALARY)
    expect(upd.apply(p.proposal, ctx).ok).toBe(false)
  })
})

describe('delete_income', () => {
  it('is strong, deletes, and undoes with the same row', () => {
    const del = write('delete_income')
    const p = del.propose({ ref: refOf(LATER) }, ctx)
    expect(p.ok && p.proposal.risk).toBe('strong')
    if (!p.ok) return
    expect(p.proposal.preview.effect).toBeUndefined()
    const applied = del.apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(state().incomeSources.map((i) => i.id)).toEqual([SALARY, FREELANCE])
    if (!applied.ok) return
    expect(applied.undo).toBeTypeOf('function')
    state().updateIncomeSource(FREELANCE, { name: 'Edited later' })
    applied.undo?.()
    expect(state().incomeSources.map((i) => i.id).sort()).toEqual([SALARY, FREELANCE, LATER].sort())
    expect(state().incomeSources.find((i) => i.id === LATER)).toEqual(source(LATER, { name: 'Rent out', amount: 5000, dayOfMonth: 22, recurringFrequency: 'biweekly', paydayDays: [22, 27] }))
    expect(state().incomeSources.find((i) => i.id === FREELANCE)?.name).toBe('Edited later')
  })

  it('warns that deleting the last source clears the income, and sets noIncomeDeclared', () => {
    useFinanceStore.setState({ incomeSources: [source(SALARY, {})] })
    const del = write('delete_income')
    const p = del.propose({ ref: refOf(SALARY) }, ctx)
    expect(p.ok && p.proposal.preview.effect).toBeTruthy()
    if (!p.ok) return
    del.apply(p.proposal, ctx)
    expect(state().settings.noIncomeDeclared).toBe(true)
  })

  it('fails on a stale proposal', () => {
    const del = write('delete_income')
    const p = del.propose({ ref: refOf(LATER) }, ctx)
    if (!p.ok) throw new Error('propose failed')
    state().deleteIncomeSource(LATER)
    expect(del.apply(p.proposal, ctx).ok).toBe(false)
  })
})

describe('mark_payday_received', () => {
  const mark = () => write('mark_payday_received')

  it('logs the only open payday as confirmed and undoes', () => {
    const p = mark().propose({ ref: refOf(SALARY) }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    expect(p.proposal.args).toMatchObject({ payday: '2026-10-15', amount: 20000, date: '2026-10-19' })
    const applied = mark().apply(p.proposal, ctx)
    expect(applied.ok).toBe(true)
    expect(state().incomeEvents).toHaveLength(1)
    expect(state().incomeEvents[0]).toMatchObject({ templateId: SALARY, occurrenceDate: '2026-10-15', receivedDate: '2026-10-19', amount: 20000, status: 'confirmed', currency: 'EGP', sourceType: 'salary' })
    expect(read('list_income').sources.find((s: Row) => s.ref === refOf(SALARY))!.paydays[0].status).toBe('received')
    if (applied.ok) applied.undo?.()
    expect(state().incomeEvents).toHaveLength(0)
  })

  it('stores a lower amount as partial and a higher one as confirmed', () => {
    const p = mark().propose({ ref: refOf(SALARY), amount: 15000 }, ctx)
    if (!p.ok) throw new Error('propose failed')
    expect(p.proposal.preview.rows.find((r) => r.label === 'Status')?.value).toMatch(/Partial/)
    mark().apply(p.proposal, ctx)
    expect(state().incomeEvents[0].status).toBe('partial')

    const top = mark().propose({ ref: refOf(SALARY), payday: '2026-10-15', amount: 25000 }, ctx)
    if (!top.ok) throw new Error('propose failed')
    mark().apply(top.proposal, ctx)
    expect(state().incomeEvents).toHaveLength(1)
    expect(state().incomeEvents[0]).toMatchObject({ amount: 25000, status: 'confirmed' })
  })

  it('updates the existing event for that payday instead of adding a second, and undo restores it', () => {
    const first = mark().propose({ ref: refOf(SALARY), amount: 15000, date: '2026-10-16' }, ctx)
    if (!first.ok) throw new Error('propose failed')
    mark().apply(first.proposal, ctx)
    const id = state().incomeEvents[0].id

    const p = mark().propose({ ref: refOf(SALARY), payday: '2026-10-15' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    expect(p.proposal.preview.rows.find((r) => r.label === 'Amount')?.before).toBeTruthy()
    expect(p.proposal.args.date).toBe('2026-10-16')
    const applied = mark().apply(p.proposal, ctx)
    expect(state().incomeEvents).toHaveLength(1)
    expect(state().incomeEvents[0]).toMatchObject({ id, amount: 20000, status: 'confirmed' })
    if (applied.ok) applied.undo?.()
    expect(state().incomeEvents[0]).toMatchObject({ id, amount: 15000, status: 'partial', receivedDate: '2026-10-16' })
  })

  it('refuses a no-op re-mark', () => {
    const p = mark().propose({ ref: refOf(SALARY) }, ctx)
    if (!p.ok) throw new Error('propose failed')
    mark().apply(p.proposal, ctx)
    expect(mark().propose({ ref: refOf(SALARY), payday: '2026-10-15', date: '2026-10-19' }, ctx).ok).toBe(false)
  })

  it('asks which payday when several are open', () => {
    const r = mark().propose({ ref: refOf(FREELANCE) }, ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.choices?.map((c) => c.id)).toEqual(['2026-10-05', '2026-10-20'])
  })

  it('takes a late or missed payday by date', () => {
    const p = mark().propose({ ref: refOf(FREELANCE), payday: '2026-10-05', amount: 3000, date: '2026-10-07' }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    mark().apply(p.proposal, ctx)
    expect(state().incomeEvents[0]).toMatchObject({ occurrenceDate: '2026-10-05', receivedDate: '2026-10-07', status: 'confirmed' })
  })

  it('rejects a date that is not a scheduled payday and offers the real ones', () => {
    const r = mark().propose({ ref: refOf(SALARY), payday: '2026-10-16' }, ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.choices?.[0].id).toBe('2026-10-15')
  })

  it('makes a later future payday wait for the earlier one', () => {
    const r = mark().propose({ ref: refOf(LATER), payday: '2026-10-27' }, ctx)
    expect(r.ok).toBe(false)
    expect(mark().propose({ ref: refOf(LATER), payday: '2026-10-22' }, ctx).ok).toBe(true)
  })

  it('rejects bad amounts, dates and one-time income', () => {
    expect(mark().propose({ ref: refOf(SALARY), amount: 0 }, ctx).ok).toBe(false)
    expect(mark().propose({ ref: refOf(SALARY), date: 'yesterday' }, ctx).ok).toBe(false)
    useFinanceStore.setState({ incomeSources: [source(SALARY, { isRecurring: false })] })
    expect(mark().propose({ ref: refOf(SALARY) }, ctx).ok).toBe(false)
  })

  it('fails on a stale proposal whose payday was logged meanwhile', () => {
    const p = mark().propose({ ref: refOf(SALARY) }, ctx)
    if (!p.ok) throw new Error('propose failed')
    mark().apply(p.proposal, ctx)
    expect(mark().apply(p.proposal, ctx).ok).toBe(false)
    expect(state().incomeEvents).toHaveLength(1)
  })
})

describe('audit fixes', () => {
  it('undo leaves noIncomeDeclared alone when apply did not flip it', () => {
    useFinanceStore.setState({ settings: { ...state().settings, noIncomeDeclared: false } })
    const add = write('add_income')
    const p = add.propose({ name: 'Gift', amount: 100, frequency: 'one_time' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = add.apply(p.proposal, ctx)
    useFinanceStore.setState({ settings: { ...state().settings, noIncomeDeclared: true } })
    if (applied.ok) applied.undo?.()
    expect(state().settings.noIncomeDeclared).toBe(true)
  })

  it('does not default to a credit card and rejects a future one-time date', () => {
    useFinanceStore.setState({ paymentMethods: [{ ...pm(PM_CARD, 'CIB Card', true), type: 'credit_card' } as PaymentMethod] })
    const add = write('add_income')
    const p = add.propose({ name: 'Gift', amount: 100, frequency: 'one_time' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    add.apply(p.proposal, ctx)
    expect(state().incomeEvents[0].paymentMethodId).toBeUndefined()
    expect(add.propose({ name: 'Gift', amount: 100, frequency: 'one_time', date: '2026-12-01' }, ctx)).toMatchObject({ ok: false })
  })

  it('update_income undo keeps a field edited after apply', () => {
    const upd = write('update_income')
    const p = upd.propose({ ref: refOf(SALARY), amount: 25000, name: 'Pay' }, ctx)
    if (!p.ok) throw new Error('propose failed')
    const applied = upd.apply(p.proposal, ctx)
    useFinanceStore.setState((s) => ({ incomeSources: s.incomeSources.map((i) => (i.id === SALARY ? { ...i, name: 'Mine' } : i)) }))
    if (applied.ok) applied.undo?.()
    expect(state().incomeSources.find((i) => i.id === SALARY)).toMatchObject({ name: 'Mine', amount: 20000 })
  })
})
