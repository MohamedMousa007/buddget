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

describe('legacy handlers: update_income', () => {
  it('update_income rejects junk amounts', () => {
    for (const amount of ['5,000', 'abc', -50]) {
      expect(validateActionItem(base().ctx, 'update_income', { name: 'Salary', amount })).not.toBeNull()
    }
  })
})
