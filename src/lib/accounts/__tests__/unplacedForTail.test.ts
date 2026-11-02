import { describe, expect, it } from 'vitest'
import type { Expense } from '@/lib/store/types'
import { expensesForAccount, expensesForTail } from '../unplacedForTail'

const e = (id: string, o: Partial<Expense> = {}): Expense =>
  ({ id, amount: 10, currency: 'EGP', date: '2026-10-31', description: id, category: 'Food', isRecurring: false, smsLogId: `l-${id}`, createdAt: '', updatedAt: '', ...o }) as Expense

describe('expensesForTail', () => {
  const expenses = [e('a'), e('b'), e('placed', { paymentMethodId: 'bank' }), e('other')]
  const logs = [
    { expense_id: 'a', account_last4: '001' },
    { expense_id: 'b', account_last4: '0001' },
    { expense_id: 'placed', account_last4: '001' },
    { expense_id: 'other', account_last4: '5950' },
  ]
  it('picks the unplaced expenses whose message printed the same number, in either form', () => {
    expect(expensesForTail(expenses, logs, '0001').map((x) => x.id)).toEqual(['a', 'b'])
    expect(expensesForTail(expenses, logs, '5950').map((x) => x.id)).toEqual(['other'])
  })
  it('does not attach a two-digit tail that merely ends another number, or a message from another bank', () => {
    const logs2 = [
      { expense_id: 'a', account_last4: '07', bank_name: 'CIB', sender: null },
      { expense_id: 'b', account_last4: '0001', bank_name: 'CIB', sender: null },
    ]
    expect(expensesForTail(expenses, logs2, '5507').map((x) => x.id)).toEqual([])
    expect(expensesForTail(expenses, logs2, '0001', 'hsbc').map((x) => x.id)).toEqual([])
    expect(expensesForTail(expenses, logs2, '0001', 'cib').map((x) => x.id)).toEqual(['b'])
  })
  it('never touches expenses that already have an account, or messages with no number', () => {
    expect(expensesForTail(expenses, logs, '0001').some((x) => x.id === 'placed')).toBe(false)
    expect(expensesForTail(expenses, [{ expense_id: 'a', account_last4: null }], '0001')).toEqual([])
  })
})


describe('expensesForAccount', () => {
  const account = { name: 'HSBC Egypt ••0001', last4: '0001', last4Aliases: ['5950'], currency: 'EGP' } as never
  const items = [e('noNumber'), e('sameNumber'), e('otherNumber'), e('otherBank'), e('usd', { currency: 'USD' }), e('placed', { paymentMethodId: 'x' })]
  const logs = [
    { expense_id: 'noNumber', account_last4: null, bank_name: 'HSBC Egypt', sender: null },
    { expense_id: 'sameNumber', account_last4: '001', bank_name: 'HSBC', sender: null },
    { expense_id: 'otherNumber', account_last4: '0110', bank_name: 'HSBC Egypt', sender: null },
    { expense_id: 'otherBank', account_last4: null, bank_name: 'CIB', sender: null },
    { expense_id: 'usd', account_last4: null, bank_name: 'HSBC Egypt', sender: null },
    { expense_id: 'placed', account_last4: null, bank_name: 'HSBC Egypt', sender: null },
  ]
  it('offers only same-bank messages with no number or this account\'s number, in its currency', () => {
    expect(expensesForAccount(items, logs, account).map((x) => x.id)).toEqual(['noNumber', 'sameNumber'])
  })
  it('offers nothing for an account whose bank is unknown', () => {
    expect(expensesForAccount(items, logs, { ...(account as object), name: 'My stash' } as never)).toEqual([])
  })
})
