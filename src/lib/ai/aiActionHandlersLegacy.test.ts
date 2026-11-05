import { describe, expect, it } from 'vitest'
import { executeActionItem, validateActionItem, type AIActionHandlerContext } from '@/lib/ai/aiActionHandlers'

const base = () => {
  const calls: Record<string, unknown[]> = { updateIncomeSource: [], updateExpense: [], updateGoal: [] }
  const ctx = {
    paymentMethods: [], debts: [], debtPayments: [], savingsAccounts: [],
    incomeSources: [{ id: 'i1', name: 'Salary', amount: 1000, currency: 'EGP' }],
    expenses: [{ id: 'e1', description: 'Coffee', amount: 50, currency: 'EGP', amountInBaseCurrency: 50, category: 'Food', date: '2026-10-19', createdAt: '2026-10-19T00:00:00Z' }],
    goals: [{ id: 'g1', name: 'House fund' }, { id: 'g2', name: 'Car' }],
    settings: { baseCurrency: 'EGP' }, exchangeRates: {}, goldPricePerGram: 0,
    updateIncomeSource: (...a: unknown[]) => calls.updateIncomeSource.push(a),
    updateExpense: (...a: unknown[]) => calls.updateExpense.push(a),
    updateGoal: (...a: unknown[]) => calls.updateGoal.push(a),
  } as unknown as AIActionHandlerContext
  return { ctx, calls }
}

describe('legacy handlers: expense currency and goal matching', () => {
  it('update_expense rejects an unconvertible currency', () => {
    expect(validateActionItem(base().ctx, 'update_expense', { description: 'Coffee', newAmount: 500, currency: 'XYZ' })).not.toBeNull()
  })
  it('update_goal reports an unknown goal', () => {
    expect(validateActionItem(base().ctx, 'update_goal', { name: 'Wedding', status: 'paused' })).not.toBeNull()
  })
  it('update_goal accepts a name that matches exactly one goal', () => {
    expect(validateActionItem(base().ctx, 'update_goal', { name: 'Car', status: 'paused' })).toBeNull()
  })
})
