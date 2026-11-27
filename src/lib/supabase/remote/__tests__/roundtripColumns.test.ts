import { describe, expect, it } from 'vitest'
import { expenseToRow, expenseFromRow } from '../mappers/expenseMapper'
import { savingsAccountToRow, savingsAccountFromRow } from '../mappers/savingsAccountMapper'
import { goalToRow } from '../mappers/goalMapper'
import { savingsTransactionFromRow } from '../mappers/savingsTransactionMapper'
import { paymentMethodFromRow, paymentMethodToRow } from '../mappers/paymentMethodMapper'
import type { Expense, Goal, PaymentMethod, SavingsAccount } from '@/lib/store/types'

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
  it('keeps savings account goal part fields and emoji; never sends the retired target_amount', () => {
    const a = { id: 'a', name: 'N', category: 'savings', type: 'bank', currency: 'EGP', currentBalance: 1, goalId: 'g', isMonthlySavings: true, emoji: '🏠', createdAt: 'x' } as unknown as SavingsAccount
    const row = savingsAccountToRow(a, 'u')
    expect('target_amount' in row).toBe(false)
    const back = savingsAccountFromRow({ ...row, updated_at: 'x', deleted_at: null } as never)
    expect(back).toMatchObject({ goalId: 'g', isMonthlySavings: true, emoji: '🏠' })
  })
  it('a pocket cached before 0355 (no goalId) never sends goal_id, so the backfill survives; the system vault is flagged', () => {
    const a = { id: 'a', name: 'N', category: 'savings', type: 'bank', currency: 'EGP', currentBalance: 1, createdAt: 'x' } as unknown as SavingsAccount
    expect('goal_id' in savingsAccountToRow(a, 'u')).toBe(false)
    expect('is_monthly_savings' in savingsAccountToRow(a, 'u')).toBe(false)
    const vault = { ...a, id: '55555555-5555-4448-3334-222211111111' }
    expect(savingsAccountToRow(vault, '11111111-2222-4333-8444-555555555555').is_monthly_savings).toBe(true)
    expect(savingsAccountToRow({ ...a, goalId: null }, 'u').goal_id).toBeNull()
  })
  it('writes cancelled goals as cancelled', () => {
    expect(goalToRow({ id: 'g', status: 'cancelled', name: 'g' } as Goal, 'u').status).toBe('cancelled')
  })
  it('reads withdraw as a withdrawal and a correction as non-cash', () => {
    const base = { id: 't', account_id: 'a', amount: 5, currency: 'EGP', transaction_date: '2026-10-10', is_cash_flow: true }
    expect(savingsTransactionFromRow({ ...base, kind: 'withdraw' } as never).type).toBe('withdrawal')
    expect(savingsTransactionFromRow({ ...base, kind: 'correct' } as never).isCashFlow).toBe(false)
  })

  it('P3 (0360): a card keeps the account that pays it and the savings flag', () => {
    const pm = { id: 'c', name: 'Card', type: 'credit_card', currency: 'EGP', isDefault: false, paysFromPaymentMethodId: 'nbe', isSavings: true } as PaymentMethod
    const row = paymentMethodToRow(pm, 'u')
    expect([row.pays_from_payment_method_id, row.is_savings]).toEqual(['nbe', true])
    const back = paymentMethodFromRow({ ...row, created_at: 'x', edited_at: 'x' } as never)
    expect([back.paysFromPaymentMethodId, back.isSavings]).toEqual(['nbe', true])
    const plain = paymentMethodToRow({ ...pm, paysFromPaymentMethodId: undefined, isSavings: undefined }, 'u')
    expect([plain.pays_from_payment_method_id, plain.is_savings]).toEqual([null, false])
  })
})
