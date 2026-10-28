import { describe, expect, it, vi } from 'vitest'
import type { Debt, DebtPayment, Expense, IncomeSource, RecurringExpense, Subscription } from '@/lib/store/types'

vi.mock('./mappers/subscriptionMapper', () => ({ subscriptionToRow: (s: { id: string }, u: string) => ({ row: 'sub', id: s.id, u }) }))
vi.mock('./mappers/recurringExpenseMapper', () => ({ recurringExpenseToRow: (r: { id: string }, u: string) => ({ row: 're', id: r.id, u }) }))
vi.mock('./mappers/incomeSourceMapper', () => ({ incomeSourceToRow: (i: { id: string }, u: string) => ({ row: 'inc', id: i.id, u }) }))
vi.mock('./mappers/debtMapper', () => ({ debtToRow: (d: { id: string }, u: string) => ({ row: 'debt', id: d.id, u }) }))
vi.mock('./mappers/debtPaymentMapper', () => ({ debtPaymentToRow: (p: { id: string }, u: string) => ({ row: 'pay', id: p.id, u }) }))
vi.mock('./mappers/expenseMapper', () => ({ expenseToRow: (e: { id: string }, u: string) => ({ row: 'exp', id: e.id, u }) }))

import {
  addDebtPaymentWithExpenseRpc,
  addIncomeWithDebtRpc,
  addSubscriptionWithRecurringExpenseRpc,
  cancelSubscriptionRpc,
  correctSavingsBalanceRpc,
  depositToSavingsRpc,
  reactivateSubscriptionRpc,
  updateSubscriptionAndReRpc,
  withdrawFromSavingsRpc,
} from './rpc'

type Reply = { data: unknown; error: { message: string } | null }
function client(reply: Reply) {
  const rpc = vi.fn(async () => reply)
  return { rpc, c: { rpc } as unknown as Parameters<typeof depositToSavingsRpc>[0] }
}
const obj = <T,>(id: string) => ({ id }) as unknown as T

describe('savings RPCs', () => {
  it('deposit maps params to p_* and turns omitted optionals into undefined, keeping a zero amount', async () => {
    const { rpc, c } = client({ data: 'tx1', error: null })
    expect(await depositToSavingsRpc(c, { account_id: 'a', amount: 0, currency: 'EGP', notes: null })).toBe('tx1')
    expect(rpc).toHaveBeenCalledWith('deposit_to_savings', {
      p_account_id: 'a', p_amount: 0, p_currency: 'EGP', p_notes: undefined, p_date: undefined, p_transaction_id: undefined,
    })
  })

  it('withdraw and correct call their own functions with the supplied idempotency id', async () => {
    const w = client({ data: 'tx2', error: null })
    await withdrawFromSavingsRpc(w.c, { account_id: 'a', amount: 5, currency: 'AED', date: '2026-10-01', transaction_id: 't' })
    expect(w.rpc).toHaveBeenCalledWith('withdraw_from_savings', expect.objectContaining({ p_amount: 5, p_date: '2026-10-01', p_transaction_id: 't' }))
    const k = client({ data: 'tx3', error: null })
    await correctSavingsBalanceRpc(k.c, { account_id: 'a', new_balance: 0 })
    expect(k.rpc).toHaveBeenCalledWith('correct_savings_balance', expect.objectContaining({ p_new_balance: 0 }))
  })

  it('throws with the function name on a database error, and when no id comes back', async () => {
    await expect(depositToSavingsRpc(client({ data: null, error: { message: 'insufficient' } }).c, { account_id: 'a', amount: 1, currency: 'EGP' }))
      .rejects.toThrow('deposit_to_savings: insufficient')
    await expect(withdrawFromSavingsRpc(client({ data: null, error: null }).c, { account_id: 'a', amount: 1, currency: 'EGP' }))
      .rejects.toThrow('withdraw_from_savings: no data returned')
  })
})

describe('subscription RPCs', () => {
  it('cancel and reactivate pass the id and surface errors', async () => {
    const ok = client({ data: null, error: null })
    await cancelSubscriptionRpc(ok.c, 's1')
    await reactivateSubscriptionRpc(ok.c, 's1')
    expect(ok.rpc).toHaveBeenNthCalledWith(1, 'cancel_subscription', { p_subscription_id: 's1' })
    expect(ok.rpc).toHaveBeenNthCalledWith(2, 'reactivate_subscription', { p_subscription_id: 's1' })
    await expect(cancelSubscriptionRpc(client({ data: null, error: { message: 'nope' } }).c, 's1')).rejects.toThrow('cancel_subscription: nope')
    await expect(reactivateSubscriptionRpc(client({ data: null, error: { message: 'nope' } }).c, 's1')).rejects.toThrow('reactivate_subscription: nope')
  })

  it('add maps both entities under the user id', async () => {
    const { rpc, c } = client({ data: { subscription_id: 's', recurring_expense_id: 'r' }, error: null })
    const out = await addSubscriptionWithRecurringExpenseRpc(c, 'u1', obj<Subscription>('s'), obj<RecurringExpense>('r'))
    expect(out).toEqual({ subscription_id: 's', recurring_expense_id: 'r' })
    expect(rpc).toHaveBeenCalledWith('add_subscription_with_recurring_expense', {
      p_subscription: { row: 'sub', id: 's', u: 'u1' }, p_recurring_expense: { row: 're', id: 'r', u: 'u1' },
    })
  })

  it('update passes both patches and throws on error', async () => {
    const { rpc, c } = client({ data: null, error: null })
    await updateSubscriptionAndReRpc(c, 's1', { name: 'x' }, { amount: 2 })
    expect(rpc).toHaveBeenCalledWith('update_subscription_and_re', {
      p_subscription_id: 's1', p_subscription_updates: { name: 'x' }, p_recurring_expense_updates: { amount: 2 },
    })
    await expect(updateSubscriptionAndReRpc(client({ data: null, error: { message: 'bad' } }).c, 's1', {}, {})).rejects.toThrow('update_subscription_and_re: bad')
  })
})

describe('atomic income and debt-payment RPCs', () => {
  it('income+debt maps both rows under the user', async () => {
    const { rpc, c } = client({ data: { income_id: 'i', debt_id: 'd' }, error: null })
    await addIncomeWithDebtRpc(c, 'u1', obj<IncomeSource>('i'), obj<Debt>('d'))
    expect(rpc).toHaveBeenCalledWith('add_income_with_debt', { p_income: { row: 'inc', id: 'i', u: 'u1' }, p_debt: { row: 'debt', id: 'd', u: 'u1' } })
  })

  it('debt payment + expense map under the user and throw when the pair is not returned', async () => {
    const ok = client({ data: { debt_payment_id: 'p', expense_id: 'e' }, error: null })
    expect(await addDebtPaymentWithExpenseRpc(ok.c, 'u1', obj<DebtPayment>('p'), obj<Expense>('e'))).toEqual({ debt_payment_id: 'p', expense_id: 'e' })
    expect(ok.rpc).toHaveBeenCalledWith('add_debt_payment_with_expense', { p_payment: { row: 'pay', id: 'p', u: 'u1' }, p_expense: { row: 'exp', id: 'e', u: 'u1' } })
    await expect(addDebtPaymentWithExpenseRpc(client({ data: null, error: null }).c, 'u1', obj<DebtPayment>('p'), obj<Expense>('e')))
      .rejects.toThrow('add_debt_payment_with_expense: no data returned')
  })
})
