import { describe, it, expect } from 'vitest'
import type { Debt, DebtPayment, Expense, BudgetPlanCategory } from '@/lib/store/types'
import { computeCreditCardOutstanding, cardChargesDetail } from '@/lib/debt/computeCreditCardBalance'
import { effectivePlanCategoryAmountInBase, isPlanCategoryUnconverted } from '@/lib/budget/budgetPlans'
import { calculateCashOutflow, computeDebtPaymentRecord, isDebtFullyPaid, isExpenseUnconverted } from './calculations'
import { deriveZakatBase } from '@/lib/savings/zakatInputs'
import { sumConverted } from './currency'

const RATES = { USD_EGP: 50, EGP_USD: 0.02 }
const exp = (over: Partial<Expense>): Expense =>
  ({ id: 'e', date: '2026-10-05', description: 'x', category: 'Food', amount: 100, currency: 'EGP', amountInBaseCurrency: 100,
    paymentMethodId: 'pm', isRecurring: false, createdAt: '', updatedAt: '', ...over }) as Expense

describe('sumConverted', () => {
  it('skips and flags rows with no path', () => {
    expect(sumConverted([1, 2, 3], (n) => (n === 2 ? null : n))).toEqual({ total: 4, incomplete: true })
  })
})

describe('D13 card outstanding', () => {
  const card = { id: 'c', debtType: 'credit_card', currency: 'EGP', startingBalance: 0, linkedPaymentMethodId: 'pm' } as unknown as Debt
  it('does not count an unconvertible KWD charge as EGP', () => {
    const expenses = [exp({ amount: 100, currency: 'KWD' }), exp({ id: 'f', amount: 40 })]
    expect(computeCreditCardOutstanding(card, expenses, [], RATES)).toBe(40)
    expect(cardChargesDetail(card, expenses, RATES)).toEqual({ total: 40, incomplete: true })
  })
})

describe('R17 plan rows', () => {
  const row = { amount: 100, currency: 'KWD', subcategories: [] } as unknown as BudgetPlanCategory
  it('counts an unconvertible row as 0 and flags it', () => {
    expect(effectivePlanCategoryAmountInBase(row, 'EGP', RATES)).toBe(0)
    expect(isPlanCategoryUnconverted(row, 'EGP', RATES)).toBe(true)
  })
})

describe('L17 helper', () => {
  it('flags an expense with no path', () => {
    expect(isExpenseUnconverted({ amount: 5, currency: 'KWD' }, 'EGP', RATES)).toBe(true)
    expect(isExpenseUnconverted({ amount: 5, currency: 'USD' }, 'EGP', RATES)).toBe(false)
  })
})

describe('L23 spend-excluded cash', () => {
  it('still counts a spend-excluded expense as cash out', () => {
    const out = calculateCashOutflow({
      monthExpenses: [exp({ amount: 70, spendExclusion: 'for_someone' }), exp({ id: 't', category: 'Transfer', amount: 999 })],
      monthDebtPayments: [] as DebtPayment[], debts: [], monthSavingsDeposits: 0, baseCurrency: 'EGP', exchangeRates: RATES,
    })
    expect(out).toBe(70)
  })
})

describe('D16 dust', () => {
  it('treats sub-cent remainder as fully paid', () => {
    const d = { id: 'd', debtType: 'personal', currency: 'USD', startingBalance: 100, status: 'active' } as unknown as Debt
    const p = { debtId: 'd', amountPaid: 99.999 } as DebtPayment
    expect(isDebtFullyPaid(d, [p])).toBe(true)
    expect(isDebtFullyPaid(d, [{ ...p, amountPaid: 99 } as DebtPayment])).toBe(false)
  })
})

describe('D3 gold grams paid on a cash debt', () => {
  it('prices grams through the gram price, not as base money', () => {
    const d = { id: 'd', debtType: 'personal', currency: 'EGP', startingBalance: 100_000, status: 'active', isGold: false } as unknown as Debt
    const r = computeDebtPaymentRecord(d, 5, 'XAU', 'EGP', RATES, 4000, [])
    expect(r).toMatchObject({ ok: true, amountInBase: 20_000, amountInDebtUnit: 20_000 })
  })
})

describe('W17 zakat', () => {
  const run = (over: Record<string, unknown>) =>
    deriveZakatBase({
      savingsAccounts: [], investmentHoldings: [], debts: [], baseCurrency: 'EGP',
      exchangeRates: RATES, goldPricePerGram: 6000, goldPriceAvailable: true, lookup: (() => null) as never, ...over,
    } as never)
  it('adds tracked account balances and skips pockets held inside them', () => {
    const r = run({
      trackedAccounts: [{ balance: 1000, currency: 'EGP' }, { balance: 10, currency: 'USD' }],
      savingsAccounts: [{ id: 'p', category: 'savings', type: 'cash', currency: 'EGP', currentBalance: 300 }],
      heldInPocketIds: new Set(['p']),
    })
    expect(r.cashAndSavings).toBe(1500)
    expect(r.incomplete).toBe(false)
  })
  it('fails closed on unconvertible balances and debts, and caps debt at what is owed', () => {
    const debt = { id: 'd', currency: 'EGP', installmentAmount: 100, installmentFrequency: 'monthly', startingBalance: 250, direction: 'i_owe', debtType: 'personal' }
    const r = run({
      trackedAccounts: [{ balance: 5, currency: 'KWD' }],
      debts: [debt], debtPayments: [],
    })
    expect(r.cashAndSavings).toBe(0)
    expect(r.incomplete).toBe(true)
    expect(r.debtsDueThisYear).toBe(250)
  })
})
