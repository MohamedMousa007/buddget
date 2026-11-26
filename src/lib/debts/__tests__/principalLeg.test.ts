import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { computeBalances } from '@/lib/accounts/balance'
import { accountsBasisFor } from '@/lib/accounts/netWorthBasis'
import { isPaymentMethodReferenced } from '@/lib/accounts/removePaymentMethod'
import { setOpeningBalance } from '@/lib/accounts/actions'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { computeMonthlyStats } from '@/lib/utils/monthlyStats'
import { isReportSpendRow } from '@/lib/constants/categoryMeta'
import { cycleKeyFor } from '@/lib/settings/payCycle'
import { localTodayISO } from '@/lib/utils/localDate'
import { debtFromRow, debtToRow } from '@/lib/supabase/remote/mappers/debtMapper'
import type { DebtRow } from '@/lib/supabase/remote/types'
import type { Currency, Debt, DebtCurrency } from '@/lib/store/types'
import {
  findPrincipalMatch, linkedExpensePatch, linkedIncomePatch, principalAccount, principalLegFields, principalMovesByDefault,
} from '../principalLeg'

const DAY = 86_400_000
const START = 20_000
const s = () => useFinanceStore.getState()
const base = () => s().settings.baseCurrency
const ago = (days: number) => new Date(Date.now() - days * DAY)
const ledger = () => ({
  paymentMethods: s().paymentMethods, expenses: s().expenses, incomeEvents: s().incomeEvents, debts: s().debts, debtPayments: s().debtPayments,
  savingsTransactions: s().savingsTransactions, savingsAccounts: s().savingsAccounts, adjustments: s().accountAdjustments,
  convert: (a: number, f: string, t: string) => (f === t ? a : null),
})
const stats = () => {
  const st = s()
  return computeMonthlyStats({
    expenses: st.expenses, incomeSources: st.incomeSources, incomeEvents: st.incomeEvents, budgetCategories: st.budgetCategories,
    budgetPlans: st.budgetPlans, budgetPlanActivations: st.budgetPlanActivations, activeBudgetPlanId: st.activeBudgetPlanId,
    savingsHoldings: st.savingsHoldings, savingsAccounts: st.savingsAccounts, savingsTransactions: st.savingsTransactions,
    debts: st.debts, debtPayments: st.debtPayments, settings: st.settings, exchangeRates: st.exchangeRates,
    goldPricePerGram: 0, goldPriceAvailable: false, monthFilter: cycleKeyFor(new Date(), st.settings.monthStartDay), trustLocalFinance: true,
  })
}
/** The figures that must not move when a principal leg is booked: it is not spending, income or cash outflow. */
const flow = () => {
  const m = stats()
  return { totalIncome: m.totalIncome, totalSpent: m.totalSpent, spend: m.totalSpentExcludingSavings, cashOutflow: m.cashOutflow }
}
const netWorth = () => {
  const st = s()
  return computeNetWorth({
    ...accountsBasisFor(ledger(), base()), savingsAccounts: [], investmentHoldings: [], debts: st.debts, settings: st.settings,
    exchangeRates: st.exchangeRates, goldPricePerGram: 0, goldPriceAvailable: false, lookup: () => null, debtRemaining: stats().debtRemainingTotal,
  } as never).netWorth
}

describe('debt principal leg', () => {
  let cib = ''
  const bal = (id = cib) => computeBalances(ledger()).get(id)?.balance
  const payload = (direction: 'i_owe' | 'they_owe', amount = 5000): Omit<Debt, 'id' | 'createdAt'> => ({
    name: 'Loan', person: 'Omar', personName: 'Omar', startingBalance: amount, currency: base() as DebtCurrency, isGold: false,
    debtType: 'personal', direction, status: 'active', receivedVia: 'cash',
  })
  /** The create path of the sheet: answer "yes" books the leg on the debt row; the row then round-trips the sync mapper. */
  const create = (direction: 'i_owe' | 'they_owe', opts: { leg?: boolean; at?: Date; amount?: number } = {}) => {
    const amount = opts.amount ?? 5000
    const account = principalAccount(cib, s().paymentMethods)!
    const leg = opts.leg === false ? {} : principalLegFields(account, amount, base() as DebtCurrency, (opts.at ?? new Date()).toISOString())
    const id = s().addDebt({ ...payload(direction, amount), ...leg })
    useFinanceStore.setState((st) => ({ debts: st.debts.map((d) => (d.id === id ? debtFromRow(debtToRow(d, 'user') as DebtRow) : d)) }))
    return id
  }
  const receive = (debtId: string, amount: number) =>
    s().addDebtPayment({ debtId, date: localTodayISO(), amountPaid: amount, originalAmount: amount, paymentCurrency: base(), paymentMethodId: cib })
  const smsTransfer = (amount = 5000, daysAgo = 0, method: string | null = cib) => {
    const at = ago(daysAgo)
    s().addExpense({
      date: localTodayISO(at), occurredAt: at.toISOString(), description: 'IPN transfer', category: 'Instapay', amount,
      currency: base() as Currency, paymentMethodId: method ?? undefined, isRecurring: false, smsLogId: `sms-${amount}-${daysAgo}`,
    } as never)
    return s().expenses.at(-1)!
  }
  const match = (direction: 'i_owe' | 'they_owe', amount = 5000) => findPrincipalMatch({
    direction, accountId: cib, amount, currency: base(), at: Date.now(), expenses: s().expenses, incomeEvents: s().incomeEvents, paymentMethods: s().paymentMethods,
    incomeSources: s().incomeSources, monthStartDay: s().settings.monthStartDay, rates: s().exchangeRates,
  })

  beforeEach(() => {
    s().reset()
    cib = s().addPaymentMethod({ name: 'CIB', type: 'bank_account', currency: base(), isDefault: true })
    setOpeningBalance(cib, START, ago(10))
  })

  it('lending 5,000 from CIB lowers CIB and net worth by 5,000 and is not spending, income or cash outflow', () => {
    const nw = netWorth()
    const before = flow()
    create('they_owe')
    expect(bal()).toBe(START - 5000)
    expect(netWorth()).toBe(nw - 5000)
    expect(flow()).toEqual(before)
    expect(s().expenses).toHaveLength(0)
    expect(s().incomeEvents).toHaveLength(0)
  })

  it('a full repayment puts CIB and net worth back exactly where they started', () => {
    const nw = netWorth()
    const id = create('they_owe')
    receive(id, 5000)
    expect(bal()).toBe(START)
    expect(netWorth()).toBe(nw)
  })

  it('partial repayments restore the account step by step', () => {
    const nw = netWorth()
    const id = create('they_owe')
    receive(id, 2000)
    expect(bal()).toBe(START - 3000)
    expect(netWorth()).toBe(nw - 3000)
    receive(id, 3000)
    expect(bal()).toBe(START)
    expect(netWorth()).toBe(nw)
  })

  it('borrowing into CIB raises CIB, leaves net worth flat (cash up, debt up) and paying back returns both to the start', () => {
    const nw = netWorth()
    const before = flow()
    const id = create('i_owe')
    expect(bal()).toBe(START + 5000)
    expect(netWorth()).toBe(nw)
    expect(flow()).toEqual(before)
    s().addDebtPaymentWithExpense(
      { debtId: id, date: localTodayISO(), amountPaid: 5000, originalAmount: 5000, paymentCurrency: base(), paymentMethodId: cib },
      { date: localTodayISO(), description: 'Loan — debt payment', category: 'Debt', amount: 5000, currency: base() as Currency, paymentMethodId: cib, isRecurring: false, linkedDebtId: id, isDebtPayment: true } as never,
    )
    expect(bal()).toBe(START)
    expect(netWorth()).toBe(nw)
  })

  it('before the account opening the question defaults to No, but an explicit Yes still moves the balance (QA W4 P1)', () => {
    const account = principalAccount(cib, s().paymentMethods)!
    expect(principalMovesByDefault(account, ago(30).getTime())).toBe(false)
    expect(principalMovesByDefault(account, Date.now())).toBe(true)
    create('they_owe', { at: ago(30) })
    expect(bal()).toBe(START - 5000)
  })

  it('answering No books no leg: today\'s behaviour, and debts that never had one stay untouched', () => {
    const nw = netWorth()
    const id = create('they_owe', { leg: false })
    const d = s().debts.find((x) => x.id === id)!
    expect([d.principalPaymentMethodId, d.principalAmount, d.principalCurrency, d.principalAt]).toEqual([undefined, undefined, undefined, undefined])
    expect(bal()).toBe(START)
    expect(netWorth()).toBe(nw)
  })

  it('deleting the debt removes its leg: the account is back', () => {
    const id = create('they_owe')
    expect(bal()).toBe(START - 5000)
    s().deleteDebt(id)
    expect(bal()).toBe(START)
  })

  it('editing the debt amount never rewrites the past balance', () => {
    const id = create('they_owe')
    s().updateDebt(id, { startingBalance: 9000 })
    expect(bal()).toBe(START - 5000)
    expect(s().debts.find((d) => d.id === id)!.principalAmount).toBe(5000)
  })

  it('the leg survives the sync mapper, and the in-store Cash sentinel is sent as NULL', () => {
    const id = create('they_owe')
    const d = s().debts.find((x) => x.id === id)!
    const row = debtToRow(d, 'user')
    expect(row).toMatchObject({ principal_payment_method_id: cib, principal_amount: 5000, principal_currency: base(), principal_at: d.principalAt })
    expect(debtFromRow(row as DebtRow)).toMatchObject({ principalPaymentMethodId: cib, principalAmount: 5000, principalCurrency: base(), principalAt: d.principalAt })
    expect(debtToRow({ ...d, principalPaymentMethodId: 'pm_default_cash' }, 'user').principal_payment_method_id).toBeNull()
    const bare = debtToRow({ ...payload('they_owe'), id: 'x', createdAt: d.createdAt }, 'user')
    expect([bare.principal_payment_method_id, bare.principal_amount, bare.principal_currency, bare.principal_at]).toEqual([null, null, null, null])
  })

  it('an account that carries a principal leg is closed, never deleted', () => {
    expect(isPaymentMethodReferenced(s(), cib)).toBe(false)
    create('they_owe')
    expect(isPaymentMethodReferenced(s(), cib)).toBe(true)
  })

  it('only a tracked account of the user\'s own can carry a leg', () => {
    const card = s().addPaymentMethod({ name: 'Visa', type: 'credit_card', currency: base(), isDefault: false })
    const bnpl = s().addPaymentMethod({ name: 'valU', type: 'bnpl', currency: base(), isDefault: false })
    const untracked = s().addPaymentMethod({ name: 'NBE', type: 'bank_account', currency: base(), isDefault: false })
    const debit = s().addPaymentMethod({ name: 'CIB debit', type: 'debit_card', currency: base(), isDefault: false, parentId: cib })
    const pms = s().paymentMethods
    expect(principalAccount(card, pms)).toBeNull()
    expect(principalAccount(bnpl, pms)).toBeNull()
    expect(principalAccount(untracked, pms)).toBeNull()
    expect(principalAccount('pm_default_cash', pms)).toBeNull()
    expect(principalAccount(undefined, pms)).toBeNull()
    expect(principalAccount(debit, pms)?.id).toBe(cib)
    expect(principalAccount(cib, pms.map((m) => (m.id === cib ? { ...m, closedAt: new Date().toISOString() } : m)))).toBeNull()
  })

  it('a gold debt never moves an account even if a leg is on the row', () => {
    const id = create('they_owe')
    useFinanceStore.setState((st) => ({ debts: st.debts.map((d) => (d.id === id ? { ...d, isGold: true } : d)) }))
    expect(bal()).toBe(START)
  })

  describe('bank message already booked the transfer (double-debit guard)', () => {
    it('lending: the matching transfer is linked, the account is debited exactly once and it stops counting as spending', () => {
      const nw = netWorth()
      const e = smsTransfer()
      expect(bal()).toBe(START - 5000)
      expect(stats().totalSpentExcludingSavings).toBe(5000)
      const m = match('they_owe')
      expect(m).toEqual({ kind: 'expense', id: e.id, date: e.date })

      const id = create('they_owe', { leg: false })
      s().updateExpense(m!.id, linkedExpensePatch(id))

      expect(bal()).toBe(START - 5000)
      expect(netWorth()).toBe(nw - 5000)
      expect(stats().totalSpentExcludingSavings).toBe(0)
      // The transfer is real cash that left: it stays in the month's cash outflow, as every spend-excluded row does.
      expect(stats().cashOutflow).toBe(5000)
      const linked = s().expenses.find((x) => x.id === e.id)!
      expect(linked).toMatchObject({ linkedDebtId: id, spendExclusion: 'manual', category: 'Instapay', smsLogId: e.smsLogId })
      expect(isReportSpendRow(linked)).toBe(false)
      expect(match('they_owe')).toBeNull()

      receive(id, 5000)
      expect(bal()).toBe(START)
      expect(netWorth()).toBe(nw)
    })

    it('deleting a debt that linked a transfer keeps the one debit and counts the transfer as spending again', () => {
      const e = smsTransfer()
      const id = create('they_owe', { leg: false })
      s().updateExpense(e.id, linkedExpensePatch(id))
      s().deleteDebt(id)
      const row = s().expenses.find((x) => x.id === e.id)!
      expect(row.linkedDebtId).toBeUndefined()
      expect(row.spendExclusion).toBeUndefined()
      expect(bal()).toBe(START - 5000)
      expect(stats().totalSpentExcludingSavings).toBe(5000)
    })

    it('deleting a debt leaves a payment expense and a user-excluded row as they were', () => {
      const id = create('i_owe', { leg: false })
      s().addExpense({ date: localTodayISO(), description: 'kept out', category: 'Food', amount: 10, currency: base() as Currency, paymentMethodId: cib, isRecurring: false, linkedDebtId: id, spendExclusion: 'manual' } as never)
      s().deleteDebt(id)
      expect(s().expenses.at(-1)!.spendExclusion).toBe('manual')
    })

    it('does not match a different amount, an old transfer, another account, an unplaced message or a row already tied to something', () => {
      smsTransfer(4999)
      smsTransfer(5000, 5)
      smsTransfer(5000, 1, null)
      const other = s().addPaymentMethod({ name: 'NBE', type: 'bank_account', currency: base(), isDefault: false })
      smsTransfer(5000, 1, other)
      expect(match('they_owe')).toBeNull()
      const e = smsTransfer(5000, 2)
      expect(match('they_owe')?.id).toBe(e.id)
      s().updateExpense(e.id, { spendExclusion: 'for_someone' })
      expect(match('they_owe')).toBeNull()
      s().updateExpense(e.id, { spendExclusion: undefined, refundKind: 'refunded' })
      expect(match('they_owe')).toBeNull()
    })

    it('a purchase of the same amount is never taken for the transfer', () => {
      s().addExpense({ date: localTodayISO(), description: 'Laptop', category: 'Shopping', amount: 5000, currency: base() as Currency, paymentMethodId: cib, isRecurring: false } as never)
      expect(match('they_owe')).toBeNull()
    })

    it('the closest transfer in time wins', () => {
      smsTransfer(5000, 2)
      const near = smsTransfer(5000, 1)
      expect(match('they_owe')?.id).toBe(near.id)
    })

    it('borrowing: the matching deposit is linked as borrowed money and the account is credited exactly once', () => {
      const at = new Date()
      s().addIncomeEvent({ name: 'Transfer in', amount: 5000, currency: base() as Currency, receivedDate: localTodayISO(at), occurredAt: at.toISOString(), status: 'confirmed', paymentMethodId: cib, smsLogId: 'sms-in' } as never)
      const ev = s().incomeEvents.at(-1)!
      expect(bal()).toBe(START + 5000)
      expect(match('they_owe')).toBeNull()
      const m = match('i_owe')
      expect(m).toEqual({ kind: 'income', id: ev.id, date: ev.receivedDate })
      const incomeBefore = stats().totalIncome

      const id = create('i_owe', { leg: false })
      s().updateIncomeEvent(m!.id, linkedIncomePatch(id))
      expect(bal()).toBe(START + 5000)
      // Borrowed money is not income (council Q3): the link takes the deposit out of income and keeps its own type.
      expect(incomeBefore).toBe(5000)
      expect(stats().totalIncome).toBe(0)
      expect(s().incomeEvents.find((x) => x.id === ev.id)!.linkedDebtId).toBe(id)
      expect(s().incomeEvents.find((x) => x.id === ev.id)!.sourceType).toBe(ev.sourceType)
      expect(match('i_owe')).toBeNull()
    })

    it('borrowing never matches salary-style income or a pending credit', () => {
      const add = (extra: object) => s().addIncomeEvent({ name: 'In', amount: 5000, currency: base() as Currency, receivedDate: localTodayISO(), status: 'confirmed', paymentMethodId: cib, ...extra } as never)
      add({ templateId: 'salary' })
      add({ status: 'expected' })
      add({ exclusion: 'pass_through' })
      expect(match('i_owe')).toBeNull()
    })
  })
})
