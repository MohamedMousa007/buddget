import { beforeEach, describe, expect, it } from 'vitest'
import { TOOLS } from '@/lib/buddgy/tools/exec'
import { refOf } from '@/lib/buddgy/tools/refs'
import type { ToolContext } from '@/lib/buddgy/tools/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Debt, DebtPayment, Goal, PaymentMethod, RecurringDebtPayment } from '@/lib/store/types'

const ctx: ToolContext = { now: new Date('2026-10-19T12:00:00'), locale: 'en' }

const CASH = 'aaaaaaaa-0000-0000-0000-000000000001'
const CARD_PM = 'd4d4d4d4-0000-0000-0000-000000000002'
const D_LOAN = 'b1b1b1b1-0000-0000-0000-000000000001'
const D_PLAN = 'c2c2c2c2-0000-0000-0000-000000000002'
const D_CARD = 'e5e5e5e5-0000-0000-0000-000000000003'
const D_OWED = 'f6f6f6f6-0000-0000-0000-000000000004'
const P1 = '1a1a1a1a-0000-0000-0000-000000000001'

const pm = (id: string, name: string, type: PaymentMethod['type'], isDefault: boolean): PaymentMethod =>
  ({ id, name, type, currency: 'EGP', isDefault }) as PaymentMethod

const debt = (id: string, over: Partial<Debt> = {}): Debt => ({
  id,
  name: 'Car loan',
  person: 'Karim',
  personName: 'Karim',
  startingBalance: 1000,
  currency: 'EGP',
  isGold: false,
  createdAt: '2026-09-01T10:00:00.000Z',
  status: 'active',
  debtType: 'personal',
  direction: 'i_owe',
  receivedVia: 'cash',
  ...over,
})

const schedule = (over: Partial<RecurringDebtPayment> = {}): RecurringDebtPayment => ({
  id: '9a9a9a9a-0000-0000-0000-000000000001',
  debtId: D_LOAN,
  amount: 250,
  currency: 'EGP',
  paymentMethodId: CASH,
  frequency: 'monthly',
  nextDueDate: '2026-10-20',
  isActive: true,
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
})

const payment = (over: Partial<DebtPayment> = {}): DebtPayment => ({
  id: P1,
  debtId: D_LOAN,
  date: '2026-10-01',
  amountPaid: 100,
  createdAt: '2026-10-01T10:00:00.000Z',
  ...over,
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
  const applied = write(tool).apply(p.proposal, ctx)
  return { proposal: p.proposal, applied }
}

beforeEach(() => {
  useFinanceStore.setState({
    paymentMethods: [pm(CASH, 'Cash', 'cash', true), pm(CARD_PM, 'CIB ••1234', 'credit_card', false)],
    expenses: [],
    debts: [debt(D_LOAN)],
    debtPayments: [],
    recurringDebtPayments: [],
    goals: [],
    incomeSources: [],
    exchangeRates: {},
    settings: { ...st().settings, baseCurrency: 'EGP' },
  })
})

describe('list_debts / get_debt', () => {
  it('lists open debts with refs, remaining, totals and next reminder', () => {
    useFinanceStore.setState({
      debts: [
        debt(D_LOAN),
        debt(D_OWED, { name: 'Laptop', person: 'Sara', personName: 'Sara', startingBalance: 400, direction: 'they_owe' }),
        debt(D_PLAN, { name: 'Fridge', person: 'Installment', debtType: 'installment', startingBalance: 1200, installmentCount: 12, installmentAmount: 100, installmentFrequency: 'monthly', startDate: '2026-10-01' }),
        debt('11111111-0000-0000-0000-000000000009', { name: 'Old', status: 'cleared' }),
      ],
      debtPayments: [payment({ amountPaid: 200 })],
      recurringDebtPayments: [schedule()],
    })
    const res = read('list_debts') as { owe: number; owedToYou: number; count: number; rows: Record<string, unknown>[] }
    expect(res.count).toBe(3)
    expect(res.owe).toBe(800 + 1200)
    expect(res.owedToYou).toBe(400)
    const loan = res.rows.find((r) => r.ref === refOf(D_LOAN))
    expect(loan).toMatchObject({ name: 'Car loan', person: 'Karim', left: 800, dir: 'i_owe', due: '2026-10-20' })
    const plan = res.rows.find((r) => r.ref === refOf(D_PLAN))
    expect(plan).toMatchObject({ kind: 'installment', each: 100, paymentsLeft: 12, due: '2026-10-01' })
    expect((read('list_debts', { status: 'cleared' }) as { count: number }).count).toBe(1)
  })

  it('get_debt returns payment refs newest first', () => {
    useFinanceStore.setState({ debtPayments: [payment(), payment({ id: '2b2b2b2b-0000-0000-0000-000000000002', date: '2026-10-10', amountPaid: 50 })] })
    const res = read('get_debt', { debt: 'car loan' }) as { left: number; payments: { ref: string; amount: number }[] }
    expect(res.left).toBe(850)
    expect(res.payments.map((p) => p.amount)).toEqual([50, 100])
    expect(res.payments[1].ref).toBe(refOf(P1))
  })
})

describe('add_debt', () => {
  const args = { name: 'Phone', person: 'Omar', direction: 'i_owe', amount: 300 }

  it('proposes, applies as a personal debt and undoes', () => {
    const p = write('add_debt').propose(args, ctx)
    expect(p.ok && p.proposal.summary).toMatch(/^Pending approval/)
    expect(st().debts).toHaveLength(1)
    const { applied } = proposeApply('add_debt', args)
    expect(applied.ok).toBe(true)
    expect(st().debts.at(-1)).toMatchObject({ name: 'Phone', person: 'Omar', personName: 'Omar', startingBalance: 300, currency: 'EGP', debtType: 'personal', direction: 'i_owe', status: 'active', isGold: false })
    if (applied.ok) applied.undo?.()
    expect(st().debts).toHaveLength(1)
  })

  it('never guesses the direction or accepts bad input', () => {
    const add = write('add_debt')
    expect(add.propose({ ...args, direction: undefined }, ctx).ok).toBe(false)
    expect(add.propose({ ...args, amount: 0 }, ctx).ok).toBe(false)
    expect(add.propose({ ...args, person: '  ' }, ctx).ok).toBe(false)
    expect(add.propose({ ...args, currency: 'ZZZ' }, ctx).ok).toBe(false)
  })

  it('stores a gold debt in grams with a karat', () => {
    const { applied } = proposeApply('add_debt', { ...args, currency: 'XAU', amount: 10, karat: 21 })
    expect(applied.ok).toBe(true)
    expect(st().debts.at(-1)).toMatchObject({ isGold: true, currency: 'XAU', goldKarat: 21, receivedVia: 'gold' })
    expect(write('add_debt').propose({ ...args, currency: 'XAU', karat: 19 }, ctx).ok).toBe(false)
  })

  it('warns about a duplicate', () => {
    const r = write('add_debt').propose({ name: 'Car loan', person: 'Karim', direction: 'i_owe', amount: 1000 }, ctx)
    expect(r.ok && r.proposal.preview.effect).toBeTruthy()
  })

  it('previews in Arabic', () => {
    const r = write('add_debt').propose(args, { ...ctx, locale: 'ar' })
    expect(r.ok && r.proposal.preview.title).toBe('إضافة دين')
  })
})

describe('add_installment_plan', () => {
  it('splits the total evenly with no interest and undoes', () => {
    const { proposal, applied } = proposeApply('add_installment_plan', { item: 'TV', total: 1000, count: 3, startDate: '2026-11-01' })
    expect(proposal.preview.rows.find((r) => r.label === 'Each installment')?.value).toMatch(/333\.33/)
    expect(applied.ok).toBe(true)
    expect(st().debts.at(-1)).toMatchObject({
      name: 'TV',
      person: 'Installment',
      debtType: 'installment',
      startingBalance: 1000,
      installmentCount: 3,
      installmentAmount: 333.33,
      installmentFrequency: 'monthly',
      startDate: '2026-11-01',
      installmentProvider: 'other',
    })
    if (applied.ok) applied.undo?.()
    expect(st().debts).toHaveLength(1)
  })

  it('needs a card for a credit-card plan and offers the cards as choices', () => {
    useFinanceStore.setState({ debts: [debt(D_LOAN), debt(D_CARD, { name: 'CIB ••1234', debtType: 'credit_card', person: '', personName: '', startingBalance: 0 })] })
    const r = write('add_installment_plan').propose({ item: 'TV', total: 900, count: 3, provider: 'credit_card' }, ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.choices).toEqual([{ id: refOf(D_CARD), label: 'CIB ••1234' }])
    const { applied } = proposeApply('add_installment_plan', { item: 'TV', total: 900, count: 3, provider: 'credit_card', card: 'CIB ••1234' })
    expect(applied.ok).toBe(true)
    expect(st().debts.at(-1)?.linkedCreditCardDebtId).toBe(D_CARD)
  })

  it('rejects a bad count and a fractional count', () => {
    const add = write('add_installment_plan')
    expect(add.propose({ item: 'TV', total: 900, count: 0 }, ctx).ok).toBe(false)
    expect(add.propose({ item: 'TV', total: 900, count: 2.5 }, ctx).ok).toBe(false)
    expect(add.propose({ item: 'TV', total: 900, count: 3, frequency: 'daily' }, ctx).ok).toBe(false)
  })
})

describe('add_credit_card', () => {
  it('creates the payment method and its debt with the card terms, then undoes both', () => {
    const { applied } = proposeApply('add_credit_card', { name: 'QNB', last4: '9876', outstanding: 500, limit: 20000, dueDay: 12 })
    expect(applied.ok).toBe(true)
    const pmRow = st().paymentMethods.find((m) => m.name === 'QNB ••9876')
    expect(pmRow).toMatchObject({ type: 'credit_card', last4: '9876', isDefault: false })
    const card = st().debts.find((d) => d.linkedPaymentMethodId === pmRow?.id)
    expect(card).toMatchObject({ debtType: 'credit_card', startingBalance: 500, creditLimit: 20000, paymentDueDay: 12, gracePeriodDays: 55, minimumPaymentPercent: 5 })
    if (applied.ok) applied.undo?.()
    expect(st().paymentMethods.some((m) => m.name === 'QNB ••9876')).toBe(false)
    expect(st().debts.some((d) => d.debtType === 'credit_card')).toBe(false)
  })

  it('refuses a card that already exists and bad digits', () => {
    useFinanceStore.setState({ debts: [debt(D_LOAN), debt(D_CARD, { name: 'CIB ••1234', debtType: 'credit_card', linkedPaymentMethodId: CARD_PM })] })
    const dup = write('add_credit_card').propose({ name: 'CIB', last4: '1234' }, ctx)
    expect(dup.ok).toBe(false)
    expect(write('add_credit_card').propose({ name: 'QNB', last4: '98' }, ctx).ok).toBe(false)
  })
})

describe('record_debt_payment', () => {
  it('records the payment and a linked Debt expense, like the pay sheet', () => {
    const { applied } = proposeApply('record_debt_payment', { debt: refOf(D_LOAN), amount: 300 })
    expect(applied.ok).toBe(true)
    expect(st().debtPayments).toHaveLength(1)
    expect(st().debtPayments[0]).toMatchObject({ debtId: D_LOAN, amountPaid: 300, paymentCurrency: 'EGP', originalAmount: 300, amountInPrimary: 300, rateAtEntry: 1, paymentMethodId: CASH, date: '2026-10-19' })
    expect(st().expenses).toHaveLength(1)
    expect(st().expenses[0]).toMatchObject({ category: 'Debt', linkedDebtId: D_LOAN, isDebtPayment: true, amount: 300, description: 'Car loan — debt payment' })
    expect(st().debts[0].status).toBe('active')
  })

  it('clears the debt when fully paid and undo reopens it and removes the records', () => {
    const p = write('record_debt_payment').propose({ debt: 'Car loan', amount: 1000 }, ctx)
    expect(p.ok && p.proposal.preview.effect).toMatch(/clears the debt/)
    const { applied } = proposeApply('record_debt_payment', { debt: 'Car loan', amount: 1000 })
    expect(st().debts[0]).toMatchObject({ status: 'cleared' })
    if (applied.ok) applied.undo?.()
    expect(st().debts[0].status).toBe('active')
    expect(st().debts[0].clearedAt).toBeUndefined()
    expect(st().debtPayments).toHaveLength(0)
    expect(st().expenses).toHaveLength(0)
  })

  it('rejects an overpayment, a paid-off debt and a zero amount', () => {
    const pay = write('record_debt_payment')
    expect(pay.propose({ debt: refOf(D_LOAN), amount: 1001 }, ctx).ok).toBe(false)
    expect(pay.propose({ debt: refOf(D_LOAN), amount: 0 }, ctx).ok).toBe(false)
    useFinanceStore.setState({ debtPayments: [payment({ amountPaid: 1000 })] })
    expect(pay.propose({ debt: refOf(D_LOAN), amount: 1 }, ctx).ok).toBe(false)
  })

  it('converts a foreign-currency payment and records the rate', () => {
    useFinanceStore.setState({ exchangeRates: { USD_EGP: 50 } })
    const { applied } = proposeApply('record_debt_payment', { debt: refOf(D_LOAN), amount: 4, currency: 'USD' })
    expect(applied.ok).toBe(true)
    expect(st().debtPayments[0]).toMatchObject({ amountPaid: 200, paymentCurrency: 'USD', originalAmount: 4, rateAtEntry: 50 })
    expect(st().expenses[0]).toMatchObject({ amount: 4, currency: 'USD', amountInBaseCurrency: 200 })
  })

  it('asks which debt when two share a name and never falls back to a default', () => {
    useFinanceStore.setState({ debts: [debt(D_LOAN), debt(D_OWED, { person: 'Mona' })] })
    const r = write('record_debt_payment').propose({ debt: 'Car loan', amount: 10 }, ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.choices).toHaveLength(2)
    const none = write('record_debt_payment').propose({ debt: 'Nope', amount: 10 }, ctx)
    expect(none.ok).toBe(false)
    expect(st().debtPayments).toHaveLength(0)
  })

  it('never falls back to the default method when the named one is unknown', () => {
    const r = write('record_debt_payment').propose({ debt: refOf(D_LOAN), amount: 10, method: 'Amex' }, ctx)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.choices?.map((c) => c.label)).toEqual(['Cash', 'CIB ••1234'])
    const named = write('record_debt_payment').propose({ debt: refOf(D_LOAN), amount: 10, method: 'cib ••1234' }, ctx)
    expect(named.ok && named.proposal.args.method).toBe(refOf(CARD_PM))
  })

  it('uses the Installment category for a BNPL plan', () => {
    const bnplPm = pm('77777777-0000-0000-0000-000000000007', 'Tabby', 'bnpl', false)
    useFinanceStore.setState({
      paymentMethods: [pm(CASH, 'Cash', 'cash', true), bnplPm],
      debts: [debt(D_PLAN, { name: 'Fridge', person: 'Installment', debtType: 'installment', startingBalance: 1200, installmentAmount: 300, linkedPaymentMethodId: bnplPm.id })],
    })
    proposeApply('record_debt_payment', { debt: refOf(D_PLAN), amount: 300 })
    expect(st().expenses[0]).toMatchObject({ category: 'Installment', description: 'Fridge — installment', linkedDebtId: D_PLAN })
  })

  it('writes a card payment with no expense', () => {
    useFinanceStore.setState({ debts: [debt(D_CARD, { name: 'CIB ••1234', debtType: 'credit_card', person: '', startingBalance: 2000, linkedPaymentMethodId: CARD_PM })] })
    const { applied } = proposeApply('record_debt_payment', { debt: refOf(D_CARD), amount: 500 })
    expect(applied.ok).toBe(true)
    expect(st().debtPayments).toHaveLength(1)
    expect(st().expenses).toHaveLength(0)
    expect(st().debts[0].status).toBe('active')
  })

  it('records money received on a debt owed to the user as a repayment, not spending', () => {
    useFinanceStore.setState({ debts: [debt(D_OWED, { direction: 'they_owe', startingBalance: 400 })] })
    const p = write('record_debt_payment').propose({ debt: refOf(D_OWED), amount: 100 }, ctx)
    expect(p.ok && p.proposal.preview.effect).toMatch(/not as spending/)
    proposeApply('record_debt_payment', { debt: refOf(D_OWED), amount: 100 })
    expect(st().debtPayments).toHaveLength(1)
    expect(st().expenses).toHaveLength(0)
  })

  it('advances the reminder after a payment and retires it when the debt is cleared', () => {
    useFinanceStore.setState({ recurringDebtPayments: [schedule()] })
    const first = proposeApply('record_debt_payment', { debt: refOf(D_LOAN), amount: 250 })
    expect(st().recurringDebtPayments[0]).toMatchObject({ nextDueDate: '2026-11-20', isActive: true })
    proposeApply('record_debt_payment', { debt: refOf(D_LOAN), amount: 750 })
    expect(st().recurringDebtPayments[0].isActive).toBe(false)
    expect(st().debts[0].status).toBe('cleared')
    expect(first.applied.ok).toBe(true)
  })

  it('undo restores the reminder date', () => {
    useFinanceStore.setState({ recurringDebtPayments: [schedule()] })
    const { applied } = proposeApply('record_debt_payment', { debt: refOf(D_LOAN), amount: 250 })
    expect(st().recurringDebtPayments[0].nextDueDate).toBe('2026-11-20')
    if (applied.ok) applied.undo?.()
    expect(st().recurringDebtPayments[0].nextDueDate).toBe('2026-10-20')
  })

  it('rejects a stale proposal once the debt was paid off elsewhere', () => {
    const p = write('record_debt_payment').propose({ debt: refOf(D_LOAN), amount: 600 }, ctx)
    expect(p.ok).toBe(true)
    if (!p.ok) return
    useFinanceStore.setState({ debtPayments: [payment({ amountPaid: 700 })] })
    expect(write('record_debt_payment').apply(p.proposal, ctx).ok).toBe(false)
    expect(st().debtPayments).toHaveLength(1)
  })
})

describe('update_debt', () => {
  it('changes the amount and undoes', () => {
    const { applied } = proposeApply('update_debt', { debt: refOf(D_LOAN), amount: 1500, name: 'Car' })
    expect(applied.ok).toBe(true)
    expect(st().debts[0]).toMatchObject({ startingBalance: 1500, name: 'Car' })
    if (applied.ok) applied.undo?.()
    expect(st().debts[0]).toMatchObject({ startingBalance: 1000, name: 'Car loan' })
  })

  it('recomputes the installment amount when the total or count changes', () => {
    useFinanceStore.setState({ debts: [debt(D_PLAN, { name: 'Fridge', person: 'Installment', debtType: 'installment', startingBalance: 1200, installmentCount: 12, installmentAmount: 100 })] })
    proposeApply('update_debt', { debt: refOf(D_PLAN), count: 6 })
    expect(st().debts[0]).toMatchObject({ installmentCount: 6, installmentAmount: 200 })
  })

  it('refuses a total below what was paid, card-only fields on a loan, and no-ops', () => {
    useFinanceStore.setState({ debtPayments: [payment({ amountPaid: 400 })] })
    const upd = write('update_debt')
    expect(upd.propose({ debt: refOf(D_LOAN), amount: 300 }, ctx).ok).toBe(false)
    expect(upd.propose({ debt: refOf(D_LOAN), limit: 5000 }, ctx).ok).toBe(false)
    expect(upd.propose({ debt: refOf(D_LOAN), name: 'Car loan' }, ctx).ok).toBe(false)
  })

  it('updates card terms but not the card name', () => {
    useFinanceStore.setState({ debts: [debt(D_CARD, { name: 'CIB ••1234', debtType: 'credit_card', person: '', startingBalance: 0, linkedPaymentMethodId: CARD_PM })] })
    proposeApply('update_debt', { debt: refOf(D_CARD), limit: 30000, dueDay: 5 })
    expect(st().debts[0]).toMatchObject({ creditLimit: 30000, paymentDueDay: 5 })
    expect(write('update_debt').propose({ debt: refOf(D_CARD), name: 'X' }, ctx).ok).toBe(false)
  })
})

describe('clear_debt', () => {
  it('marks the debt cleared, stops its reminder and undoes both', () => {
    useFinanceStore.setState({ recurringDebtPayments: [schedule()] })
    const p = write('clear_debt').propose({ debt: refOf(D_LOAN) }, ctx)
    expect(p.ok && p.proposal.preview.effect).toMatch(/stays unpaid/)
    const { applied } = proposeApply('clear_debt', { debt: refOf(D_LOAN) })
    expect(st().debts[0]).toMatchObject({ status: 'cleared', clearedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })
    expect(st().recurringDebtPayments[0].isActive).toBe(false)
    if (applied.ok) applied.undo?.()
    expect(st().debts[0].status).toBe('active')
    expect(st().debts[0].clearedAt).toBeUndefined()
    expect(st().recurringDebtPayments[0].isActive).toBe(true)
  })

  it('refuses cards and already-cleared debts', () => {
    useFinanceStore.setState({ debts: [debt(D_CARD, { debtType: 'credit_card', name: 'Card' }), debt(D_LOAN, { status: 'cleared' })] })
    expect(write('clear_debt').propose({ debt: refOf(D_CARD) }, ctx).ok).toBe(false)
    expect(write('clear_debt').propose({ debt: refOf(D_LOAN) }, ctx).ok).toBe(false)
  })
})

describe('delete_debt', () => {
  it('is strong, cascades to payments, reminders and a debt-freedom goal, keeps expenses, and undo restores everything', () => {
    useFinanceStore.setState({
      debtPayments: [payment()],
      recurringDebtPayments: [schedule()],
      expenses: [{ id: 'ee111111-0000-0000-0000-000000000001', linkedDebtId: D_LOAN, isDebtPayment: true, amount: 100, currency: 'EGP', amountInBaseCurrency: 100, category: 'Debt', date: '2026-10-01', description: 'x', paymentMethodId: CASH, isRecurring: false, createdAt: '', updatedAt: '' } as never],
      goals: [{ id: '55555555-0000-0000-0000-000000000005', name: 'Debt free', category: 'debt_freedom', status: 'active', linkedDebtIds: [D_LOAN] } as never],
    })
    const p = write('delete_debt').propose({ debt: refOf(D_LOAN) }, ctx)
    expect(p.ok && p.proposal.risk).toBe('strong')
    expect(p.ok && p.proposal.preview.effect).toMatch(/1 payment record.*1 payment reminder.*1 payment expense.*Debt-free goal removed: Debt free/)
    if (!p.ok) return
    const slices = () => {
      const { debts, debtPayments, recurringDebtPayments, goals, expenses } = st()
      // Undo re-stamps restored rows (so they win the sync tiebreak), so `updatedAt` is compared separately.
      return structuredClone({ debts, debtPayments, recurringDebtPayments, goals, expenses: expenses.map(({ updatedAt: _u, ...rest }) => rest) })
    }
    const before = slices()
    const applied = write('delete_debt').apply(p.proposal, ctx)
    expect(applied.ok && typeof applied.undo).toBe('function')
    const afterApply = slices()
    expect(st().debts).toHaveLength(0)
    expect(st().debtPayments).toHaveLength(0)
    expect(st().recurringDebtPayments).toHaveLength(0)
    expect(st().goals).toHaveLength(0)
    expect(st().expenses).toHaveLength(1)
    if (applied.ok) applied.undo?.()
    expect(slices()).toEqual(before)
    expect(afterApply.debts).toHaveLength(0)
  })

  it('undo keeps a goal that tracked other debts and its later edits', () => {
    const G = '55555555-0000-0000-0000-000000000005'
    useFinanceStore.setState({
      debts: [debt(D_LOAN), debt(D_OWED)],
      goals: [{ id: G, name: 'Debt free', category: 'debt_freedom', status: 'active', linkedDebtIds: [D_LOAN, D_OWED] } as never],
    })
    const before = structuredClone(st().goals)
    const { applied } = proposeApply('delete_debt', { debt: refOf(D_LOAN) })
    expect(st().goals[0].linkedDebtIds).toEqual([D_OWED])
    if (applied.ok) applied.undo?.()
    expect(st().goals).toEqual(before)
  })

  it('names the installment plans that lose their card link', () => {
    useFinanceStore.setState({ debts: [debt(D_CARD, { name: 'Card', debtType: 'credit_card' }), debt(D_PLAN, { debtType: 'installment', linkedCreditCardDebtId: D_CARD })] })
    const p = write('delete_debt').propose({ debt: refOf(D_CARD) }, ctx)
    expect(p.ok && p.proposal.preview.effect).toMatch(/1 installment plan/)
  })

  it('fails on an unknown debt and rejects a stale apply', () => {
    expect(write('delete_debt').propose({ debt: 'zzzzzz' }, ctx).ok).toBe(false)
    const p = write('delete_debt').propose({ debt: refOf(D_LOAN) }, ctx)
    if (!p.ok) throw new Error('expected ok')
    useFinanceStore.getState().deleteDebt(D_LOAN)
    expect(write('delete_debt').apply(p.proposal, ctx).ok).toBe(false)
  })
})

describe('delete_debt_payment', () => {
  it('is strong, deletes only the payment and reopens a cleared debt', () => {
    useFinanceStore.setState({ debts: [debt(D_LOAN, { status: 'cleared', clearedAt: '2026-10-01' })], debtPayments: [payment({ amountPaid: 1000 })] })
    const p = write('delete_debt_payment').propose({ payment: refOf(P1) }, ctx)
    expect(p.ok && p.proposal.risk).toBe('strong')
    expect(p.ok && p.proposal.preview.effect).toMatch(/active again/)
    if (!p.ok) return
    const before = structuredClone({ debts: st().debts, debtPayments: st().debtPayments, goals: st().goals })
    const applied = write('delete_debt_payment').apply(p.proposal, ctx)
    expect(st().debtPayments).toHaveLength(0)
    expect(st().debts[0]).toMatchObject({ status: 'active' })
    expect(applied.ok && typeof applied.undo).toBe('function')
    if (applied.ok) applied.undo?.()
    expect({ debts: st().debts, debtPayments: st().debtPayments, goals: st().goals }).toEqual(before)
  })

  it('fails on an unknown ref', () => {
    expect(write('delete_debt_payment').propose({ payment: 'zzzzzz' }, ctx).ok).toBe(false)
  })
})

describe('audit fixes', () => {
  it('payment undo keeps goal edits made after the payment', () => {
    useFinanceStore.setState({ goals: [{ id: '77777777-0000-0000-0000-000000000001', name: 'Trip', linkedDebtIds: [], linkedSavingsAccountIds: [], updatedAt: '2026-10-01T00:00:00.000Z' } as unknown as Goal] })
    const { applied } = proposeApply('record_debt_payment', { debt: 'Car loan', amount: 100 })
    useFinanceStore.setState((s) => ({ goals: s.goals.map((g) => ({ ...g, name: 'Trip 2' })) }))
    if (applied.ok) applied.undo?.()
    expect(st().goals[0].name).toBe('Trip 2')
    expect(st().debtPayments).toHaveLength(0)
  })

  it('update_debt undo leaves a key edited after apply alone', () => {
    const { applied } = proposeApply('update_debt', { debt: 'Car loan', name: 'Auto', amount: 1500 })
    useFinanceStore.setState((s) => ({ debts: s.debts.map((d) => ({ ...d, name: 'Mine' })) }))
    if (applied.ok) applied.undo?.()
    expect(st().debts[0]).toMatchObject({ name: 'Mine', startingBalance: 1000 })
  })

  it('refuses a second identical add_debt and add_installment_plan in one turn', () => {
    const debtArgs = { name: 'Phone', person: 'Omar', direction: 'i_owe', amount: 300 }
    const d1 = write('add_debt').propose(debtArgs, ctx)
    const d2 = write('add_debt').propose(debtArgs, ctx)
    if (!d1.ok || !d2.ok) throw new Error('propose failed')
    expect(write('add_debt').apply(d1.proposal, ctx).ok).toBe(true)
    expect(write('add_debt').apply(d2.proposal, ctx)).toMatchObject({ ok: false, error: 'Already added' })
    expect(st().debts).toHaveLength(2)

    const planArgs = { item: 'Fridge', total: 1200, count: 12 }
    const p1 = write('add_installment_plan').propose(planArgs, ctx)
    const p2 = write('add_installment_plan').propose(planArgs, ctx)
    if (!p1.ok || !p2.ok) throw new Error('propose failed')
    expect(write('add_installment_plan').apply(p1.proposal, ctx).ok).toBe(true)
    expect(write('add_installment_plan').apply(p2.proposal, ctx)).toMatchObject({ ok: false, error: 'Already added' })
    expect(st().debts).toHaveLength(3)
  })

  it('get_debt caps notes at 80 characters', () => {
    useFinanceStore.setState({ debts: [debt(D_LOAN, { notes: 'x'.repeat(200) })] })
    expect((read('get_debt', { debt: 'Car loan' }) as { notes: string }).notes).toHaveLength(80)
  })
})
