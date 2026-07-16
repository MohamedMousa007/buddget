import { describe, expect, it } from 'vitest'
import type { Debt, DebtPayment, Expense } from '@/lib/store/types'
import { computeCreditCardOutstanding, getCurrentBillingCycleExpenses } from './computeCreditCardBalance'

const RATES = { USD_EGP: 50 }
const PM = 'pm_card'

const card = (over: Partial<Debt> = {}): Debt =>
  ({
    id: 'debt_card', name: 'CIB Card', debtType: 'credit_card', direction: 'i_owe', person: '',
    startingBalance: 0, currency: 'EGP', isGold: false, linkedPaymentMethodId: PM, status: 'active',
    createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
    ...over,
  }) as Debt

const charge = (over: Partial<Expense> = {}): Expense => ({
  id: `e_${Math.random()}`, date: '2026-07-10', description: 'x', category: 'Food',
  amount: 0, currency: 'EGP', amountInBaseCurrency: 0, paymentMethodId: PM,
  isRecurring: false, createdAt: '2026-07-10T00:00:00.000Z', updatedAt: '2026-07-10T00:00:00.000Z',
  ...over,
})

const outstanding = (expenses: Expense[], payments: DebtPayment[] = [], debt = card()) =>
  computeCreditCardOutstanding(debt, expenses, payments, RATES)

describe('computeCreditCardOutstanding', () => {
  it('sums charges on the linked card', () => {
    expect(outstanding([charge({ amount: 240 }), charge({ amount: 60 })])).toBe(300)
  })

  it('ignores spend on other payment methods', () => {
    expect(outstanding([charge({ amount: 240, paymentMethodId: 'pm_bank' })])).toBe(0)
  })

  it.each(['refunded', 'declined'] as const)('excludes a %s charge — it was reversed', (refundKind) => {
    // Was counted forever, inflating the balance: expenseAmountInBase zeroes these
    // everywhere else, but this function had no such check.
    expect(outstanding([charge({ amount: 240, refundKind })])).toBe(0)
  })

  it('excludes a CC Payoff posted against the card itself', () => {
    // Without this, attaching the real funding method to a payoff (2e) would let the
    // payoff re-add itself to the balance and cancel its own payment.
    expect(
      outstanding([charge({ amount: 12_000, category: 'CC Payoff' })], [
        { id: 'p1', debtId: 'debt_card', date: '2026-07-11', amountPaid: 12_000, createdAt: '' },
      ]),
    ).toBe(0)
  })

  it('excludes other non-spend movement on the card', () => {
    expect(outstanding([charge({ amount: 1_000, category: 'ATM Cash Withdrawal' })])).toBe(0)
  })

  it('subtracts payments and never goes negative', () => {
    expect(
      outstanding([charge({ amount: 240 })], [
        { id: 'p1', debtId: 'debt_card', date: '2026-07-11', amountPaid: 500, createdAt: '' },
      ]),
    ).toBe(0)
  })

  it('converts a foreign charge into the debt currency', () => {
    expect(outstanding([charge({ amount: 10, currency: 'USD' })])).toBe(500)
  })

  it('keeps the starting balance when no method is linked', () => {
    expect(outstanding([charge({ amount: 240 })], [], card({ linkedPaymentMethodId: undefined, startingBalance: 99 })))
      .toBe(99)
  })
})

describe('getCurrentBillingCycleExpenses', () => {
  const ref = new Date(2026, 6, 15) // 15 Jul 2026
  const cycle = (expenses: Expense[]) =>
    getCurrentBillingCycleExpenses(card({ paymentDueDay: 20 }), expenses, RATES, ref).expenses

  it('includes a charge inside the window', () => {
    expect(cycle([charge({ amount: 240, date: '2026-07-10' })])).toHaveLength(1)
  })

  it('excludes a payoff made from the card bank — it is not a charge', () => {
    expect(cycle([charge({ amount: 12_000, date: '2026-07-10', category: 'CC Payoff' })])).toHaveLength(0)
  })

  it('excludes a refunded charge', () => {
    expect(cycle([charge({ amount: 240, date: '2026-07-10', refundKind: 'refunded' })])).toHaveLength(0)
  })

  it('returns nothing without a due day — the cycle is unknown', () => {
    expect(getCurrentBillingCycleExpenses(card(), [charge({ amount: 240 })], RATES, ref).expenses).toHaveLength(0)
  })
})
