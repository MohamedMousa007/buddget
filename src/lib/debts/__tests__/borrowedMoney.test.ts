import { beforeEach, describe, expect, it } from 'vitest'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { computeBalances } from '@/lib/accounts/balance'
import { accountsBasisFor } from '@/lib/accounts/netWorthBasis'
import { setOpeningBalance } from '@/lib/accounts/actions'
import { computeNetWorth } from '@/lib/savings/netWorth'
import { computeMonthlyStats } from '@/lib/utils/monthlyStats'
import { cycleCarryFigures } from '@/lib/savings/cycleCarryFigures'
import { monthlyIncomeHistory } from '@/lib/budget/factsFromStore'
import { detectFundingScenario } from '@/lib/goals/fundingScenario'
import { projectedIncomeForMonth } from '@/lib/utils/calculations'
import { cycleKeyFor } from '@/lib/settings/payCycle'
import { localTodayISO } from '@/lib/utils/localDate'
import { debtFromRow, debtToRow } from '@/lib/supabase/remote/mappers/debtMapper'
import type { DebtRow } from '@/lib/supabase/remote/types'
import type { Currency, Debt, DebtCurrency, IncomeSourceType } from '@/lib/store/types'
import { isBorrowedMoney } from '@/lib/income/borrowed'
import { incomeMatches } from '@/lib/income/paydayResolution'
import { findPrincipalMatch, linkedIncomePatch, principalAccount, principalLegFields } from '../principalLeg'
import { confirmPrincipalDuplicate, declinePrincipalDuplicate, pendingPrincipalDuplicates, principalDuplicateKey } from '../principalDuplicate'

const DAY = 86_400_000
const START = 20_000
const s = () => useFinanceStore.getState()
const base = () => s().settings.baseCurrency
const ago = (days: number) => new Date(Date.now() - days * DAY)
const monthKey = () => cycleKeyFor(new Date(), s().settings.monthStartDay)
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
    goldPricePerGram: 0, goldPriceAvailable: false, monthFilter: monthKey(), trustLocalFinance: true,
  })
}
const netWorth = () => {
  const st = s()
  return computeNetWorth({
    ...accountsBasisFor(ledger(), base()), savingsAccounts: [], investmentHoldings: [], debts: st.debts, settings: st.settings,
    exchangeRates: st.exchangeRates, goldPricePerGram: 0, goldPriceAvailable: false, lookup: () => null, debtRemaining: stats().debtRemainingTotal,
  } as never).netWorth
}
const carry = () => cycleCarryFigures({
  monthKey: monthKey(), monthStartDay: s().settings.monthStartDay, base: base() as Currency, rates: s().exchangeRates,
  expenses: s().expenses, incomeEvents: s().incomeEvents, incomeSources: s().incomeSources, deposits: [],
})!

describe('borrowed money is never income (council Q3) and a late bank row is asked about once (Q4)', () => {
  let cib = ''
  const bal = () => computeBalances(ledger()).get(cib)?.balance
  const payload = (direction: 'i_owe' | 'they_owe', amount = 5000): Omit<Debt, 'id' | 'createdAt'> => ({
    name: 'Loan', person: 'Ahmed', personName: 'Ahmed', startingBalance: amount, currency: base() as DebtCurrency, isGold: false,
    debtType: 'personal', direction, status: 'active', receivedVia: 'cash',
  })
  /** The sheet's create path: the debt row, with or without its principal leg. */
  const create = (direction: 'i_owe' | 'they_owe', leg = true, at = new Date()) => {
    const account = principalAccount(cib, s().paymentMethods)!
    return s().addDebt({ ...payload(direction), ...(leg ? principalLegFields(account, 5000, base() as DebtCurrency, at.toISOString()) : {}) })
  }
  /** A bank-message credit, as the SMS route writes it: untemplated, exact instant, placed on the account. */
  const smsDeposit = (extra: object = {}, daysAgo = 0, amount = 5000) => {
    const at = ago(daysAgo)
    s().addIncomeEvent({ name: 'Transfer in', amount, currency: base() as Currency, sourceType: 'other', receivedDate: localTodayISO(at), occurredAt: at.toISOString(), status: 'confirmed', paymentMethodId: cib, smsLogId: `sms-in-${s().incomeEvents.length}`, ...extra } as never)
    return s().incomeEvents.at(-1)!
  }
  const smsTransfer = (daysAgo = 0, amount = 5000) => {
    const at = ago(daysAgo)
    s().addExpense({ date: localTodayISO(at), occurredAt: at.toISOString(), description: 'IPN transfer', category: 'Instapay', amount, currency: base() as Currency, paymentMethodId: cib, isRecurring: false, smsLogId: `sms-out-${s().expenses.length}` } as never)
    return s().expenses.at(-1)!
  }
  const match = () => findPrincipalMatch({
    direction: 'i_owe', accountId: cib, amount: 5000, currency: base(), at: Date.now(), expenses: s().expenses, incomeEvents: s().incomeEvents,
    incomeSources: s().incomeSources, monthStartDay: s().settings.monthStartDay, rates: s().exchangeRates, paymentMethods: s().paymentMethods,
  })
  const pending = () => pendingPrincipalDuplicates({
    debts: s().debts, expenses: s().expenses, incomeEvents: s().incomeEvents, incomeSources: s().incomeSources, paymentMethods: s().paymentMethods,
    monthStartDay: s().settings.monthStartDay, rates: s().exchangeRates, promptState: s().settings.promptState,
  })
  const debitsOnCib = () => START - (bal() ?? 0)

  beforeEach(() => {
    s().reset()
    cib = s().addPaymentMethod({ name: 'CIB', type: 'bank_account', currency: base(), isDefault: true })
    setOpeningBalance(cib, START, ago(10))
  })

  describe('income totals', () => {
    it('money recorded as borrowed raises the account and stays out of month income, received income, carry and history; net worth does not move', () => {
      const nw = netWorth()
      s().addIncomeWithDebt({ name: 'From Ahmed', amount: 5000, currency: base() as Currency, isRecurring: false, paymentMethodId: cib } as never, payload('i_owe'))
      const ev = s().incomeEvents.at(-1)!
      expect(ev).toMatchObject({ sourceType: 'debt', linkedDebtId: s().debts.at(-1)!.id })
      expect(isBorrowedMoney(ev)).toBe(true)
      expect(bal()).toBe(START + 5000)
      expect(netWorth()).toBe(nw)
      expect(stats().totalIncome).toBe(0)
      expect(stats().receivedIncome).toBe(0)
      expect(carry().income).toBe(0)
    })

    it('a real deposit beside it still counts, alone', () => {
      s().addIncomeWithDebt({ name: 'From Ahmed', amount: 5000, currency: base() as Currency, isRecurring: false, paymentMethodId: cib } as never, payload('i_owe'))
      smsDeposit({}, 0, 700)
      expect(stats().totalIncome).toBe(700)
      expect(carry().income).toBe(700)
      expect(bal()).toBe(START + 5700)
    })

    it('past months restate: income history and the funding scenario ignore a borrowed credit', () => {
      const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 10)
      const day = localTodayISO(lastMonth)
      const row = { id: 'x', name: 'In', amount: 5000, currency: base() as Currency, receivedDate: day, status: 'confirmed' as const, createdAt: day, updatedAt: day }
      const scenario = (extra: object) => detectFundingScenario({ incomeEvents: [{ ...row, ...extra }], budgetCategories: [], budgetPlanCount: 0, currentMonth: localTodayISO().slice(0, 7) })
      expect(monthlyIncomeHistory([row], base() as Currency, {}, new Date())).toEqual([5000])
      expect(monthlyIncomeHistory([{ ...row, linkedDebtId: 'd' }], base() as Currency, {}, new Date())).toEqual([])
      expect(monthlyIncomeHistory([{ ...row, sourceType: 'debt' }], base() as Currency, {}, new Date())).toEqual([])
      expect(scenario({})).toBe('B')
      expect(scenario({ linkedDebtId: 'd' })).toBe('C')
      expect(scenario({ sourceType: 'debt' as IncomeSourceType })).toBe('C')
    })

    it('a legacy one-time source that was borrowed money is in neither the projected nor the actual month', () => {
      s().addIncomeSource({ name: 'Old loan', amount: 5000, currency: base() as Currency, isRecurring: false, sourceType: 'debt', linkedDebtId: 'gone' } as never)
      useFinanceStore.setState({ incomeEvents: [] })
      expect(s().incomeSources).toHaveLength(1)
      expect(projectedIncomeForMonth(s().incomeSources, base() as Currency, s().exchangeRates, monthKey(), s().settings.monthStartDay)).toBe(0)
      expect(stats().totalIncome).toBe(0)
    })

    it('paying borrowed money back is spending once, and the principal is counted nowhere twice', () => {
      const nw = netWorth()
      const id = create('i_owe')
      expect(stats().totalIncome).toBe(0)
      expect(stats().totalSpentExcludingSavings).toBe(0)
      s().addDebtPaymentWithExpense(
        { debtId: id, date: localTodayISO(), amountPaid: 5000, originalAmount: 5000, paymentCurrency: base(), paymentMethodId: cib },
        { date: localTodayISO(), description: 'Loan payment', category: 'Debt', amount: 5000, currency: base() as Currency, paymentMethodId: cib, isRecurring: false, linkedDebtId: id, isDebtPayment: true } as never,
      )
      expect(bal()).toBe(START)
      expect(netWorth()).toBe(nw)
      expect(stats().totalIncome).toBe(0)
      expect(stats().totalSpentExcludingSavings).toBe(5000)
      expect(stats().cashOutflow).toBe(5000)
    })
  })

  describe('a paycheck is never offered as the borrowed deposit', () => {
    it('offers a plain one-off credit', () => {
      const ev = smsDeposit({}, 1)
      expect(match()?.id).toBe(ev.id)
    })

    it('never a credit tied to a recurring source, typed as salary, or already borrowed', () => {
      smsDeposit({ templateId: 'tpl' }, 1)
      smsDeposit({ sourceType: 'salary' }, 1)
      smsDeposit({ sourceType: 'debt' }, 1)
      expect(match()).toBeNull()
    })

    it('never a credit that payday resolution would link to an open payday', () => {
      const ev = smsDeposit({}, 1)
      expect(match()?.id).toBe(ev.id)
      const payday = ago(1).getDate()
      s().addIncomeSource({ name: 'Salary', amount: 5000, currency: base() as Currency, isRecurring: true, frequency: 'monthly', dayOfMonth: payday, paydayDays: [payday], sourceType: 'salary' } as never)
      useFinanceStore.setState((st) => ({ incomeSources: st.incomeSources.map((x) => ({ ...x, effectiveStart: localTodayISO(ago(40)), createdAt: ago(40).toISOString() })) }))
      expect(match()).toBeNull()
    })
  })

  describe('unlinking', () => {
    it('a linked deposit leaves income, keeps its own type, and deleting the debt counts it again as what it was', () => {
      const ev = smsDeposit({ sourceType: 'gift' })
      expect(stats().totalIncome).toBe(5000)
      const id = create('i_owe', false)
      s().updateIncomeEvent(ev.id, linkedIncomePatch(id))
      expect(s().incomeEvents.find((x) => x.id === ev.id)).toMatchObject({ linkedDebtId: id, sourceType: 'gift' })
      expect(stats().totalIncome).toBe(0)
      expect(bal()).toBe(START + 5000)

      s().deleteDebt(id)
      const after = s().incomeEvents.find((x) => x.id === ev.id)!
      expect(after.linkedDebtId).toBeUndefined()
      expect(after.sourceType).toBe('gift')
      expect(stats().totalIncome).toBe(5000)
      expect(bal()).toBe(START + 5000)
    })

    it('money that was recorded as borrowed from the start does not flip into income when its debt is deleted', () => {
      s().addIncomeWithDebt({ name: 'From Ahmed', amount: 5000, currency: base() as Currency, isRecurring: false, paymentMethodId: cib } as never, payload('i_owe'))
      s().deleteDebt(s().debts.at(-1)!.id)
      expect(s().incomeEvents.at(-1)).toMatchObject({ sourceType: 'debt' })
      expect(s().incomeEvents.at(-1)!.linkedDebtId).toBeUndefined()
      expect(stats().totalIncome).toBe(0)
      // It is still not a paycheck: payday matching must not pick it up once the link is gone.
      const payday = new Date().getDate()
      s().addIncomeSource({ name: 'Salary', amount: 5000, currency: base() as Currency, isRecurring: true, frequency: 'monthly', dayOfMonth: payday, paydayDays: [payday], sourceType: 'salary' } as never)
      useFinanceStore.setState((st) => ({ incomeSources: st.incomeSources.map((x) => ({ ...x, effectiveStart: localTodayISO(ago(40)), createdAt: ago(40).toISOString() })) }))
      expect(incomeMatches(s().incomeSources, s().incomeEvents, s().settings.monthStartDay, s().exchangeRates, new Date(), [])).toEqual([])
    })
  })

  describe('a bank row that arrives after the debt booked its leg', () => {
    it('lending: asked about the transfer; Yes keeps the bank row, clears the leg, and the account is debited exactly once', () => {
      const id = create('they_owe', true, ago(1))
      expect(pending()).toEqual([])
      const e = smsTransfer()
      expect(debitsOnCib()).toBe(10000)
      const [dup] = pending()
      expect(dup).toMatchObject({ debt: { id }, match: { kind: 'expense', id: e.id } })

      const undo = confirmPrincipalDuplicate(dup)
      expect(debitsOnCib()).toBe(5000)
      const debt = s().debts.find((d) => d.id === id)!
      expect(debt).toMatchObject({ principalPaymentMethodId: undefined, principalAmount: undefined, principalCurrency: undefined, principalAt: undefined })
      expect(debtToRow(debt, 'u')).toMatchObject({ principal_payment_method_id: null, principal_amount: null, principal_currency: null, principal_at: null })
      expect(debtFromRow(debtToRow(debt, 'u') as DebtRow).principalAt).toBeUndefined()
      expect(s().expenses.find((x) => x.id === e.id)).toMatchObject({ linkedDebtId: id, spendExclusion: 'manual', smsLogId: e.smsLogId })
      expect(stats().totalSpentExcludingSavings).toBe(0)
      expect(pending()).toEqual([])

      undo()
      expect(debitsOnCib()).toBe(10000)
      expect(s().debts.find((d) => d.id === id)!.principalAmount).toBe(5000)
      expect(s().expenses.find((x) => x.id === e.id)!.linkedDebtId).toBeUndefined()
      expect(pending()).toHaveLength(1)
    })

    it('lending: No keeps both movements and never asks about that row again, but a later row is still asked about', () => {
      const id = create('they_owe', true, ago(1))
      const e = smsTransfer()
      declinePrincipalDuplicate(pending()[0])
      expect(s().settings.promptState?.[principalDuplicateKey(id, e.id)]).toBeTruthy()
      expect(pending()).toEqual([])
      expect(debitsOnCib()).toBe(10000)
      expect(s().debts.find((d) => d.id === id)!.principalAmount).toBe(5000)
      expect(s().expenses.find((x) => x.id === e.id)!.spendExclusion).toBeUndefined()

      const later = smsTransfer()
      expect(pending().map((p) => p.match.id)).toEqual([later.id])
    })

    it('borrowing: asked about the deposit; Yes credits the account once and the deposit is not income', () => {
      const nw = netWorth()
      const id = create('i_owe', true, ago(1))
      const ev = smsDeposit()
      expect(bal()).toBe(START + 10000)
      expect(stats().totalIncome).toBe(5000)
      const [dup] = pending()
      expect(dup).toMatchObject({ debt: { id }, match: { kind: 'income', id: ev.id } })

      confirmPrincipalDuplicate(dup)
      expect(bal()).toBe(START + 5000)
      expect(netWorth()).toBe(nw)
      expect(stats().totalIncome).toBe(0)
      expect(s().debts.find((d) => d.id === id)!.principalPaymentMethodId).toBeUndefined()
      expect(s().incomeEvents.find((x) => x.id === ev.id)).toMatchObject({ linkedDebtId: id, sourceType: 'other' })
      expect(pending()).toEqual([])
    })

    it('borrowing: No keeps both, the deposit stays income, and it is not asked again', () => {
      create('i_owe', true, ago(1))
      smsDeposit()
      declinePrincipalDuplicate(pending()[0])
      expect(pending()).toEqual([])
      expect(bal()).toBe(START + 10000)
      expect(stats().totalIncome).toBe(5000)
    })

    it('borrowing: a salary credit is never asked about', () => {
      create('i_owe', true, ago(1))
      smsDeposit({ sourceType: 'salary' })
      smsDeposit({ templateId: 'tpl' })
      expect(pending()).toEqual([])
    })

    it('stays quiet for another amount, a row outside 3 days, a debt with no leg and a cleared debt', () => {
      const id = create('they_owe', true, ago(1))
      smsTransfer(0, 4999)
      smsTransfer(5)
      create('they_owe', false)
      expect(pending()).toEqual([])
      smsTransfer()
      expect(pending()).toHaveLength(1)
      s().updateDebt(id, { status: 'cleared' })
      expect(pending()).toEqual([])
    })

    it('two debts never claim the same row', () => {
      create('they_owe', true, ago(1))
      create('they_owe', true, ago(1))
      smsTransfer()
      expect(pending()).toHaveLength(1)
    })
  })
})
