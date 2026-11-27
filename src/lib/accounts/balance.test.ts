import { describe, expect, it } from 'vitest'
import { computeBalances } from '@/lib/accounts/balance'
import type { Expense, PaymentMethod } from '@/lib/store/types'

const cash = { id: 'cash', name: 'Cash', type: 'cash', currency: 'EGP', isDefault: true, openingBalance: 200, openingAt: '2026-10-01T00:00:00.000Z' } as PaymentMethod
const exp = (over: Partial<Expense> = {}): Expense => ({
  id: 'e', date: '2026-10-05', description: 'x', category: 'Shopping', amount: 100, currency: 'EGP', amountInBaseCurrency: 100,
  paymentMethodId: 'pm_default_cash', isRecurring: false, createdAt: '', updatedAt: '', ...over,
})
const balance = (e: Expense) =>
  computeBalances({ paymentMethods: [cash], expenses: [e], incomeEvents: [], debtPayments: [], debts: [], savingsTransactions: [], savingsAccounts: [], adjustments: [], convert: (a) => a }).get('cash')?.balance

describe('computeBalances unplaced SMS transfer', () => {
  it('credits the destination account and debits nothing when the source is unknown', () => {
    expect(balance(exp({ category: 'Transfer', paymentMethodId: undefined, smsLogId: 'log', toPaymentMethodId: 'cash' }))).toBe(300)
    expect(balance(exp({ smsLogId: 'log' }))).toBe(200)
  })
})

describe('computeBalances partial refund', () => {
  it('debits only the part of the purchase that was not refunded', () => {
    expect(balance(exp())).toBe(100)
    expect(balance(exp({ refundedAmount: 30 }))).toBe(130)
    expect(balance(exp({ refundedAmount: 100 }))).toBe(200)
  })
})

describe('computeBalances month flows (account sheet "In / Out this month")', () => {
  const run = (expenses: Expense[], adjustments: { id: string; paymentMethodId: string; delta: number; reason: 'manual_update'; occurredAt: string }[] = [], flowsFrom?: number) =>
    computeBalances({ paymentMethods: [cash], expenses, incomeEvents: [], debtPayments: [], debts: [], savingsTransactions: [], savingsAccounts: [], adjustments: adjustments as never, convert: (a) => a, flowsFrom }).get('cash')
  const nov = Date.parse('2026-11-01T00:00:00.000Z')
  it('splits movements since the given instant into money in and money out', () => {
    const b = run([
      exp({ id: 'old', date: '2026-10-20', amount: 40, paymentMethodId: 'cash' }),
      exp({ id: 'out', date: '2026-11-03', amount: 25, paymentMethodId: 'cash' }),
      exp({ id: 'in', date: '2026-11-04', amount: 60, category: 'Transfer', paymentMethodId: 'other', toPaymentMethodId: 'cash' }),
    ], [], nov)
    expect(b?.flowsIn).toBe(60)
    expect(b?.flowsOut).toBe(25)
    expect(b?.balance).toBe(195)
  })
  it('a balance correction is neither money in nor money out', () => {
    const b = run([], [{ id: 'j', paymentMethodId: 'cash', delta: 500, reason: 'manual_update', occurredAt: '2026-11-05T00:00:00.000Z' }], nov)
    expect(b?.balance).toBe(700)
    expect(b?.flowsIn).toBe(0)
    expect(b?.flowsOut).toBe(0)
  })
  it('without the instant there are no flow figures', () => {
    expect(run([])?.flowsIn).toBeUndefined()
  })
})

describe('month-end carry is a label on money already in the account', () => {
  const bank = { id: 'bank', name: 'CIB', type: 'bank_account', currency: 'EGP', openingBalance: 1000, openingAt: '2026-10-01T00:00:00.000Z' } as PaymentMethod
  const vault = { id: 'v', name: 'Monthly Savings', category: 'savings', type: 'vault', currency: 'EGP', currentBalance: 300, heldInPaymentMethodId: 'bank', createdAt: '2026-10-01' }
  // adjust_pocket_balance stores its idempotency key as transfer_group_id, so a server carry row has a group of one.
  const carry = (type: 'deposit' | 'withdrawal', amount: number) => ({
    id: `t-${type}`, accountId: 'v', type, amount, currency: 'EGP', date: '2026-10-31', source: 'carry', transferGroupId: `g-${type}`, isCashFlow: true,
  })
  const bal = (txs: unknown[]) =>
    computeBalances({ paymentMethods: [bank], expenses: [], incomeEvents: [], debtPayments: [], debts: [], savingsTransactions: txs as never, savingsAccounts: [vault] as never, adjustments: [], convert: (a) => a }).get('bank')?.balance
  it('a carry deposit with no account leg leaves the bank balance alone', () => {
    expect(bal([carry('deposit', 300)])).toBe(1000)
  })
  it('a carry adjustment withdrawal with no account leg leaves it alone too', () => {
    expect(bal([carry('withdrawal', 100)])).toBe(1000)
  })
})
