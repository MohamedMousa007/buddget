import { describe, expect, it } from 'vitest'
import type {
  Debt,
  DebtPayment,
  Expense,
  PaymentMethod,
  SavingsAccount,
  SavingsTransaction,
} from '@/lib/store/types'
import {
  calculateCashOutflow,
  calculateTotalSpentExcludingSavings,
  cashSavingsDepositsInBaseForMonth,
  netSavingsLedgerInBaseForMonth,
  totalDebtRemainingInBase,
  totalSavingsAccountsBalanceInBase,
} from './calculations'

/**
 * The net-worth double-count, pinned end-to-end.
 *
 * These compose the same production functions `useNetWorth` does, so they fail against
 * the old `monthlyFlow = totalIncome − totalSpentExcludingSavings` basis:
 *   - a 240 CC purchase moved net worth −480 (spend→flow AND outstanding→debt)
 *   - a 300 BNPL purchase moved it −600 (full purchase as spend AND a full-amount debt)
 *   - a 300 savings deposit moved it +300 (balance up, income never left flow)
 */

/** Rates are keyed by PAIR (`FROM_TO`), not by currency — a single-key map silently
 *  falls through to DEFAULT_RATES. */
const RATES = { USD_EGP: 50, EGP_USD: 1 / 50 }
const BASE = 'EGP' as const
const INCOME = 10_000

const CARD_PM: PaymentMethod = {
  id: 'pm_card', name: 'CIB ••2016', type: 'credit_card', currency: 'EGP', isDefault: false,
}
const BANK_PM: PaymentMethod = {
  id: 'pm_bank', name: 'HSBC ••0001', type: 'bank_account', currency: 'EGP', isDefault: true,
}

const debt = (over: Partial<Debt> = {}): Debt => ({
  id: 'debt_x', name: 'Debt', debtType: 'general', direction: 'i_owe', person: '',
  startingBalance: 0, currency: 'EGP', isGold: false, status: 'active',
  createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
  ...over,
}) as Debt

const cardDebt = (over: Partial<Debt> = {}): Debt =>
  debt({ id: 'debt_card', name: 'CIB Card', debtType: 'credit_card', linkedPaymentMethodId: CARD_PM.id, ...over })

const expense = (over: Partial<Expense> = {}): Expense => ({
  id: `exp_${Math.random()}`, date: '2026-07-10', description: 'x', category: 'Food',
  amount: 0, currency: 'EGP', amountInBaseCurrency: 0, paymentMethodId: BANK_PM.id,
  isRecurring: false, createdAt: '2026-07-10T00:00:00.000Z', updatedAt: '2026-07-10T00:00:00.000Z',
  ...over,
})

const payment = (over: Partial<DebtPayment> = {}): DebtPayment => ({
  id: `pay_${Math.random()}`, debtId: 'debt_card', date: '2026-07-11', amountPaid: 0,
  createdAt: '2026-07-11T00:00:00.000Z',
  ...over,
})

/** Mirrors useNetWorth: savings + investments + (income − cashOutflow) − debtRemaining. */
function netWorthOf(s: {
  expenses?: Expense[]
  debts?: Debt[]
  debtPayments?: DebtPayment[]
  savingsAccounts?: SavingsAccount[]
  savingsDeposits?: number
}): number {
  const expenses = s.expenses ?? []
  const debts = s.debts ?? []
  const debtPayments = s.debtPayments ?? []
  const totalSavings = totalSavingsAccountsBalanceInBase(s.savingsAccounts ?? [], BASE, RATES, 0, true)
  const debtRemainingTotal = totalDebtRemainingInBase(debts, debtPayments, BASE, RATES, 0, true, expenses)
  const cashOutflow = calculateCashOutflow({
    monthExpenses: expenses,
    monthDebtPayments: debtPayments,
    debts,
    monthSavingsDeposits: s.savingsDeposits ?? 0,
    baseCurrency: BASE,
    exchangeRates: RATES,
  })
  return totalSavings + (INCOME - cashOutflow) - debtRemainingTotal
}

const BASELINE = INCOME

describe('net worth — each event must move it exactly once', () => {
  it('baseline', () => {
    expect(netWorthOf({})).toBe(BASELINE)
  })

  // Reproduces the defect this function exists to fix, so a revert to the accrual basis
  // fails loudly rather than silently halving everyone's net worth again.
  it('REGRESSION: the old accrual basis moved net worth −480 for one 240 charge', () => {
    const expenses = [expense({ amount: 240, amountInBaseCurrency: 240, paymentMethodId: CARD_PM.id })]
    const debts = [cardDebt()]

    const oldFlow = INCOME - calculateTotalSpentExcludingSavings(expenses, BASE, RATES)
    const debtRemaining = totalDebtRemainingInBase(debts, [], BASE, RATES, 0, true, expenses)
    const oldNetWorth = oldFlow - debtRemaining

    expect(oldNetWorth).toBe(BASELINE - 480) // spend→flow AND outstanding→debt
    expect(netWorthOf({ expenses, debts })).toBe(BASELINE - 240) // fixed
  })

  it('a 240 credit-card purchase moves net worth by −240, not −480', () => {
    const nw = netWorthOf({
      expenses: [expense({ amount: 240, amountInBaseCurrency: 240, paymentMethodId: CARD_PM.id })],
      debts: [cardDebt()],
    })
    expect(nw).toBe(BASELINE - 240)
  })

  it('paying the card off nets to zero — cash down, liability down by the same amount', () => {
    const withCharge = {
      expenses: [expense({ amount: 240, amountInBaseCurrency: 240, paymentMethodId: CARD_PM.id })],
      debts: [cardDebt()],
    }
    const before = netWorthOf(withCharge)
    const after = netWorthOf({ ...withCharge, debtPayments: [payment({ amountPaid: 240 })] })
    expect(after).toBe(before)
    expect(after).toBe(BASELINE - 240)
  })

  it('a 240 debit purchase moves net worth by −240 via the cash side instead', () => {
    expect(netWorthOf({ expenses: [expense({ amount: 240, amountInBaseCurrency: 240 })] }))
      .toBe(BASELINE - 240)
  })

  it('a 300 BNPL purchase moves net worth by −300, not −600', () => {
    const bnplDebt = debt({ id: 'debt_bnpl', name: 'Tabby', debtType: 'installment', startingBalance: 300 })
    const nw = netWorthOf({
      expenses: [expense({ amount: 300, amountInBaseCurrency: 300, linkedDebtId: 'debt_bnpl' })],
      debts: [bnplDebt],
    })
    expect(nw).toBe(BASELINE - 300)
  })

  it('an UNSPLIT bnpl-ish purchase with no debt still counts — exclusion is gated on the debt, not the method', () => {
    // Excluding by pm.type would erase this from net worth entirely: no debt exists to carry it.
    expect(netWorthOf({ expenses: [expense({ amount: 300, amountInBaseCurrency: 300, linkedDebtId: undefined })] }))
      .toBe(BASELINE - 300)
  })

  it('card spend with NO linked debt still counts — nothing else would record it', () => {
    const nw = netWorthOf({
      expenses: [expense({ amount: 240, amountInBaseCurrency: 240, paymentMethodId: CARD_PM.id })],
      debts: [cardDebt({ linkedPaymentMethodId: undefined })],
    })
    expect(nw).toBe(BASELINE - 240)
  })

  it('a 300 savings deposit leaves net worth unchanged — cash became an asset', () => {
    const account = { id: 'sav_1', currentBalance: 300, currency: 'EGP', category: 'savings' } as SavingsAccount
    expect(netWorthOf({ savingsAccounts: [account], savingsDeposits: 300 })).toBe(BASELINE)
  })

  it('declaring a pre-existing 50k account RAISES net worth by 50k — it is not cash flow', () => {
    // The opening balance must not be netted out of the flow, or the account you just
    // told the app about would be worth nothing.
    const account = { id: 'sav_2', currentBalance: 50_000, currency: 'EGP', category: 'savings' } as SavingsAccount
    expect(netWorthOf({ savingsAccounts: [account], savingsDeposits: 0 })).toBe(BASELINE + 50_000)
  })
})

describe('cashSavingsDepositsInBaseForMonth', () => {
  const tx = (over: Partial<SavingsTransaction>): SavingsTransaction => ({
    id: `tx_${Math.random()}`, accountId: 'sav_1', type: 'deposit', amount: 0,
    currency: 'EGP', date: '2026-07-10', ...over,
  })
  const sum = (rows: SavingsTransaction[]) =>
    cashSavingsDepositsInBaseForMonth(rows, '2026-07', 1, BASE, RATES)

  it('counts a real deposit', () => {
    expect(sum([tx({ amount: 300 })])).toBe(300)
  })

  it.each([
    ['an opening balance', 'Opening balance'],
    ['an imported prior balance', 'Balance from previous savings record'],
    ['a correction / revaluation', 'Manual balance correction'],
  ])('ignores %s', (_label, notes) => {
    expect(sum([tx({ amount: 50_000, notes, isCashFlow: false })])).toBe(0)
  })

  it('ignores withdrawals — withdrawFromSavings already posts an IncomeEvent, so they net to zero already', () => {
    expect(sum([tx({ type: 'withdrawal', amount: 300 })])).toBe(0)
  })

  it('treats a legacy row with no flag as real cash (safe default)', () => {
    expect(sum([tx({ amount: 300, isCashFlow: undefined })])).toBe(300)
  })
})

describe('netSavingsLedgerInBaseForMonth', () => {
  it('skips non-cash rows — declaring a 50k account must not wipe out leftToSpend', () => {
    const opening: SavingsTransaction = {
      id: 'tx_o', accountId: 'sav_1', type: 'deposit', amount: 50_000, currency: 'EGP',
      date: '2026-07-10', notes: 'Opening balance', isCashFlow: false,
    }
    expect(netSavingsLedgerInBaseForMonth([opening], '2026-07', 1, BASE, RATES)).toBe(0)
  })
})

describe('calculateCashOutflow', () => {
  const outflow = (over: Parameters<typeof calculateCashOutflow>[0]) => calculateCashOutflow(over)

  it('counts a payoff once, from debtPayments — the manual and recurring paths write no expense row', () => {
    expect(
      outflow({
        monthExpenses: [],
        monthDebtPayments: [payment({ amountPaid: 12_000 })],
        debts: [cardDebt()],
        monthSavingsDeposits: 0,
        baseCurrency: BASE,
        exchangeRates: RATES,
      }),
    ).toBe(12_000)
  })

  it('does not double-count when the SMS path DID write a CC Payoff expense alongside the payment', () => {
    expect(
      outflow({
        monthExpenses: [expense({ amount: 12_000, amountInBaseCurrency: 12_000, category: 'CC Payoff', paymentMethodId: BANK_PM.id })],
        monthDebtPayments: [payment({ amountPaid: 12_000 })],
        debts: [cardDebt()],
        monthSavingsDeposits: 0,
        baseCurrency: BASE,
        exchangeRates: RATES,
      }),
    ).toBe(12_000)
  })

  it('ignores payments toward a personal debt — its repayment already posts a Debt spend row', () => {
    const personal = debt({ id: 'debt_p', name: 'Ahmed', debtType: 'personal', startingBalance: 500 })
    expect(
      outflow({
        monthExpenses: [expense({ amount: 500, amountInBaseCurrency: 500, category: 'Debt' })],
        monthDebtPayments: [payment({ debtId: 'debt_p', amountPaid: 500 })],
        debts: [personal],
        monthSavingsDeposits: 0,
        baseCurrency: BASE,
        exchangeRates: RATES,
      }),
    ).toBe(500)
  })

  it('converts a foreign-currency debt payment into base', () => {
    expect(
      outflow({
        monthExpenses: [],
        monthDebtPayments: [payment({ debtId: 'debt_usd', amountPaid: 100 })],
        debts: [cardDebt({ id: 'debt_usd', currency: 'USD' })],
        monthSavingsDeposits: 0,
        baseCurrency: BASE,
        exchangeRates: RATES,
      }),
    ).toBe(5_000)
  })

  it('excludes a refunded card purchase from both sides', () => {
    const refunded = expense({ amount: 240, amountInBaseCurrency: 240, refundKind: 'refunded' })
    expect(
      outflow({
        monthExpenses: [refunded],
        monthDebtPayments: [],
        debts: [],
        monthSavingsDeposits: 0,
        baseCurrency: BASE,
        exchangeRates: RATES,
      }),
    ).toBe(0)
  })
})
