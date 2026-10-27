import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { confirmRecurringDebtPayment, reconcileDebtSchedule } from '@/lib/debts/recurringDebtDueHandlers'
import { computeBalances } from '@/lib/accounts/balance'
import type { Debt, PaymentMethod, RecurringDebtPayment, Subscription } from '@/lib/store/types'

const st = () => useFinanceStore.getState()
const base = () => st().settings.baseCurrency

const bank = { id: 'bank', name: 'Bank', type: 'bank_account', currency: 'EGP', isDefault: true, openingBalance: 1000, openingAt: '2026-10-01T00:00:00.000Z', createdAt: '' } as PaymentMethod
const loan: Debt = {
  id: 'd1', name: 'Loan', person: 'Ahmed', startingBalance: 1000, currency: 'EGP', isGold: false,
  debtType: 'personal', direction: 'i_owe', status: 'active', createdAt: '2026-07-01',
}
const schedule = (over: Partial<RecurringDebtPayment> = {}): RecurringDebtPayment => ({
  id: 's1', debtId: 'd1', amount: 100, currency: 'EGP', paymentMethodId: 'bank',
  frequency: 'monthly', nextDueDate: '2026-11-05', isActive: true, createdAt: '2026-07-01', ...over,
})
const payExpense = (amount = 400) => ({
  date: '2026-10-05', description: 'Loan', category: 'Debt', amount, currency: 'EGP' as const,
  paymentMethodId: 'bank', isRecurring: false, linkedDebtId: 'd1', isDebtPayment: true,
})

beforeEach(() => {
  useFinanceStore.setState({
    debts: [loan], debtPayments: [], recurringDebtPayments: [], expenses: [], goals: [],
    paymentMethods: [bank], accountAdjustments: [], incomeEvents: [],
  })
})
afterEach(() => vi.useRealTimers())

describe('D1: a debt payment with its expense debits the account once', () => {
  it('links the expense to the payment so the ledger does not apply both', () => {
    st().addDebtPaymentWithExpense({ debtId: 'd1', date: '2026-10-05', amountPaid: 400, paymentMethodId: 'bank', paymentCurrency: 'EGP' }, payExpense())
    const s = st()
    expect(s.expenses[0].linkedDebtPaymentId).toBe(s.debtPayments[0].id)
    const bal = computeBalances({
      paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: [], debts: s.debts,
      debtPayments: s.debtPayments, savingsTransactions: [], savingsAccounts: [], adjustments: [], convert: (a) => a,
    }, new Date('2026-11-01').getTime())
    expect(bal.get('bank')?.balance).toBe(600)
  })

  it('the recurring confirm path links the pair too', () => {
    useFinanceStore.setState({ recurringDebtPayments: [schedule({ nextDueDate: '2026-10-05' })] })
    expect(confirmRecurringDebtPayment('s1')).toBe(true)
    const s = st()
    expect(s.expenses[0].linkedDebtPaymentId).toBe(s.debtPayments[0].id)
  })
})

describe('D10: only the scheduled instalment advances the reminder', () => {
  it('a small extra payment leaves the next due date alone', () => {
    useFinanceStore.setState({ recurringDebtPayments: [schedule()] })
    reconcileDebtSchedule('d1', { amount: 10, currency: base() })
    expect(st().recurringDebtPayments[0].nextDueDate).toBe('2026-11-05')
  })
  it('a payment covering the instalment advances it', () => {
    useFinanceStore.setState({ recurringDebtPayments: [schedule()] })
    reconcileDebtSchedule('d1', { amount: 100, currency: 'EGP' })
    expect(st().recurringDebtPayments[0].nextDueDate).toBe('2026-12-05')
  })
  it('still deactivates the schedule when an extra payment settles the debt', () => {
    useFinanceStore.setState({ recurringDebtPayments: [schedule()] })
    st().addDebtPayment({ debtId: 'd1', date: '2026-10-27', amountPaid: 1000, paymentCurrency: 'EGP' })
    reconcileDebtSchedule('d1', { amount: 1000, currency: 'EGP' })
    expect(st().recurringDebtPayments[0].isActive).toBe(false)
  })
})

describe('D14: card merge', () => {
  const info = (name: string, last4: string) => ({ name, last4 })
  const cc = (over: Partial<Debt> = {}) => ({
    name: 'Card', person: '', startingBalance: 500, currency: 'EGP' as const, isGold: false,
    direction: 'i_owe' as const, status: 'active' as const, ...over,
  })
  beforeEach(() => useFinanceStore.setState({ debts: [], paymentMethods: [] }))

  it('two banks sharing last4 stay separate cards', () => {
    st().addCreditCardDebt(cc({ creditLimit: 20000 }), info('CIB', '1234'))
    st().addCreditCardDebt(cc(), info('HSBC', '1234'))
    expect(st().debts).toHaveLength(2)
    expect(st().debts[0].creditLimit).toBe(20000)
  })
  it('same bank, different last4 stay separate cards', () => {
    st().addCreditCardDebt(cc(), info('CIB', '1234'))
    st().addCreditCardDebt(cc(), info('CIB', '5678'))
    expect(st().debts).toHaveLength(2)
  })
  it('re-adding the same card keeps fields it did not provide', () => {
    st().addCreditCardDebt(cc({ creditLimit: 20000, paymentDueDay: 10 }), info('CIB', '1234'))
    st().addCreditCardDebt(cc({ startingBalance: 900, creditLimit: undefined, paymentDueDay: undefined }), info('CIB', '1234'))
    expect(st().debts).toHaveLength(1)
    expect(st().debts[0]).toMatchObject({ startingBalance: 900, creditLimit: 20000, paymentDueDay: 10 })
  })
})

const sub = (id: string) => st().subscriptions.find((s) => s.id === id) as Subscription
const recurring = (id: string) => st().recurringExpenses.find((r) => r.id === sub(id).linkedRecurringExpenseId)!
const subInput = (over: Partial<Subscription> = {}) => ({
  name: 'Netflix', brandKey: 'netflix', planName: 'Standard', planId: 'netflix_standard',
  catalogRegion: 'egypt', pendingPlanId: null, pendingAmount: null, amount: 190, currency: 'EGP',
  billingCycle: 'monthly', billingDay: 10, startDate: '2026-01-10', nextBillingDate: null,
  paymentMethodId: 'bank', expenseCategory: 'Enjoyment', status: 'active', notes: null, tracking: 'log', ...over,
}) as Parameters<ReturnType<typeof useFinanceStore.getState>['addSubscription']>[0]
const charges = () => st().expenses.filter((e) => e.linkedSubscriptionId)

describe('subscriptions (D18-D20)', () => {
  beforeEach(() => {
    useFinanceStore.setState({ subscriptions: [], recurringExpenses: [] })
    vi.useFakeTimers().setSystemTime(new Date('2026-10-17T12:00:00'))
  })

  it('D18: resuming after the billing day does not back-log the paused cycle', () => {
    const id = st().addSubscription(subInput())
    useFinanceStore.setState({ subscriptions: st().subscriptions.map((s) => ({ ...s, createdAt: '2026-01-01T00:00:00Z' })) })
    st().pauseSubscription(id)
    st().resumeSubscription(id)
    st().logDueSubscriptions()
    expect(charges()).toHaveLength(0)
  })

  it('D18: reactivating a cancelled sub does not back-log either', () => {
    const id = st().addSubscription(subInput())
    useFinanceStore.setState({ subscriptions: st().subscriptions.map((s) => ({ ...s, createdAt: '2026-01-01T00:00:00Z' })) })
    st().cancelSubscription(id)
    st().reactivateSubscription(id)
    st().logDueSubscriptions()
    expect(charges()).toHaveLength(0)
  })

  it('D19: a trial that has converted is logged on its billing day', () => {
    const id = st().addSubscription(subInput({ status: 'trial', trialEnd: '2026-10-10', billingDay: 15, startDate: '2026-10-01' }))
    useFinanceStore.setState({ subscriptions: st().subscriptions.map((s) => ({ ...s, createdAt: '2026-10-01T00:00:00Z' })) })
    st().logDueSubscriptions()
    expect(charges().map((e) => e.date)).toEqual(['2026-10-15'])
    expect(sub(id).status).toBe('trial')
  })

  it('D19: a trial still running is not logged', () => {
    st().addSubscription(subInput({ status: 'trial', trialEnd: '2026-10-30', billingDay: 15, startDate: '2026-10-01' }))
    useFinanceStore.setState({ subscriptions: st().subscriptions.map((s) => ({ ...s, createdAt: '2026-10-01T00:00:00Z' })) })
    st().logDueSubscriptions()
    expect(charges()).toHaveLength(0)
  })

  it('D20: cancel with a future end date keeps the planner row until that day', () => {
    const id = st().addSubscription(subInput())
    st().cancelSubscription(id, '2026-11-09')
    expect(recurring(id).isActive).toBe(true)
    vi.setSystemTime(new Date('2026-11-12T12:00:00'))
    st().logDueSubscriptions()
    expect(recurring(id).isActive).toBe(false)
  })

  it('D20: cancel ending today deactivates the planner row at once', () => {
    const id = st().addSubscription(subInput())
    st().cancelSubscription(id)
    expect(recurring(id).isActive).toBe(false)
  })
})
