import { describe, expect, it } from 'vitest'
import { fundingBasis } from '@/lib/goals/fundingBasis'
import type { BudgetPlan, IncomeEvent, IncomeSource } from '@/lib/store/types'

const source = { id: 's', name: 'Salary', amount: 10000, currency: 'EGP', isRecurring: true, recurringFrequency: 'monthly' } as IncomeSource
const event = { receivedDate: '2026-08-25', status: 'confirmed' } as IncomeEvent
const plan = (rent: number): BudgetPlan => ({
  id: 'p',
  name: 'Plan',
  createdAt: '2026-01-01T00:00:00Z',
  categories: [{ id: 'c1', name: 'Rent', icon: 'house', amount: rent, currency: 'EGP', subcategories: [] }],
})

const slice = (plans: BudgetPlan[], legacy: number) => ({
  incomeEvents: [event],
  incomeSources: [source],
  expenses: [],
  budgetCategories: legacy ? [{ category: 'Rent', budgetedAmount: legacy, currency: 'EGP' as const }] : [],
  budgetPlans: plans,
  activeBudgetPlanId: plans[0]?.id ?? null,
  exchangeRates: {},
  settings: { baseCurrency: 'EGP' as const },
})

describe('fundingBasis', () => {
  it('derives the usual keep from the active plan, not the legacy rows', () => {
    const basis = fundingBasis(slice([plan(3000)], 9999) as never, new Date('2026-10-18'))
    expect(basis.scenario).toBe('A')
    expect(basis.usualKeep).toBe(7000)
  })
  it('falls back to the legacy rows when there is no plan', () => {
    const basis = fundingBasis(slice([], 4000) as never, new Date('2026-10-18'))
    expect(basis.usualKeep).toBe(6000)
  })
})
