import { describe, expect, it } from 'vitest'
import { expenseToRow, expenseFromRow } from '../mappers/expenseMapper'
import { savingsAccountToRow, savingsAccountFromRow } from '../mappers/savingsAccountMapper'
import { goalToRow } from '../mappers/goalMapper'
import { savingsTransactionFromRow } from '../mappers/savingsTransactionMapper'
import type { Expense, Goal, SavingsAccount } from '@/lib/store/types'

describe('L11/W22 sync round trip', () => {
  it('keeps expense category label, subcategory, shared plan and isRecurring', () => {
    const e = {
      id: 'e', date: '2026-10-10', description: 'x', category: 'Coffee', subcategory: 'Beans', sharedPlanId: 'p1',
      amount: 5, currency: 'EGP', amountInBaseCurrency: 5, paymentMethodId: '', isRecurring: true,
      createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z',
    } as Expense
    const row = expenseToRow(e, 'u')
    expect(row.category).toBe('Other')
    const back = expenseFromRow({ ...row, updated_at: e.updatedAt, deleted_at: null } as never)
    expect(back).toMatchObject({ category: 'Coffee', subcategory: 'Beans', sharedPlanId: 'p1', isRecurring: true })
  })
  it('F3/F8: a pulled expense is unconverted (0), and a missing isRecurring writes false', () => {
    const e = { id: 'e', date: '2026-10-10', description: 'x', category: 'Food', amount: 5, currency: 'USD', amountInBaseCurrency: 250, paymentMethodId: '', createdAt: 'x', updatedAt: 'x' } as unknown as Expense
    const row = expenseToRow(e, 'u')
    expect(row.is_recurring).toBe(false)
    expect(expenseFromRow({ ...row, updated_at: 'x', deleted_at: null } as never).amountInBaseCurrency).toBe(0)
  })
  it('keeps savings account targetAmount and emoji', () => {
    const a = { id: 'a', name: 'N', category: 'savings', type: 'bank', currency: 'EGP', currentBalance: 1, targetAmount: 900, emoji: '🏠', createdAt: 'x' } as unknown as SavingsAccount
    const back = savingsAccountFromRow({ ...savingsAccountToRow(a, 'u'), updated_at: 'x', deleted_at: null } as never)
    expect(back).toMatchObject({ targetAmount: 900, emoji: '🏠' })
  })
  it('writes cancelled goals as cancelled', () => {
    expect(goalToRow({ id: 'g', status: 'cancelled', name: 'g' } as Goal, 'u').status).toBe('cancelled')
  })
  it('reads withdraw as a withdrawal and a correction as non-cash', () => {
    const base = { id: 't', account_id: 'a', amount: 5, currency: 'EGP', transaction_date: '2026-10-10', is_cash_flow: true }
    expect(savingsTransactionFromRow({ ...base, kind: 'withdraw' } as never).type).toBe('withdrawal')
    expect(savingsTransactionFromRow({ ...base, kind: 'correct' } as never).isCashFlow).toBe(false)
  })
})
