import { describe, it, expect } from 'vitest'
import { buildPlan } from '@/lib/budget/engine'
import { draftToCategories } from '@/lib/budget/draftToPlan'
import { spendByLine } from '@/lib/budget/lineSpend'
import type { BudgetFacts } from '@/lib/budget/facts'
import type { BudgetPlan } from '@/lib/store/types'

const f: BudgetFacts = {
  baseCurrency: 'AED', country: 'UAE', monthlyIncome: 15000, incomeStability: 'fixed', incomeFloor: null, household: 'solo', dependents: 0, supportsOthers: false,
  housing: 'rent', rent: 4500, rentIncludesUtilities: false, lifestyle: 'balanced', foodFrequency: null, transportMode: 'public', hasCar: false, bills: [],
  subscriptionsMonthly: 0, subscriptionCount: 0, debts: [{ id: 'd1', name: 'Visa', minimum: 300, balance: 20000, kind: 'credit_card', apr: 24 }],
  goals: [], liquidSavings: 20000, essentialsMonthly: null, emergencyTargetMonths: 3, zakatMonthly: 0, averages: {}, priorities: ['debt'], securityLean: 50, investInterest: false,
}
describe('engine plan: a debt minimum is not counted again on the Extra payoff line', () => {
  it('pays only the 300 minimum -> Extra payoff line should show 0 spent', () => {
    const draft = buildPlan(f)
    let n = 0
    const plan: BudgetPlan = { id: 'p', name: 'P', createdAt: '', categories: draftToCategories(draft, () => `c${n++}`, 'AED') }
    const extra = plan.categories.find((c) => c.name.startsWith('Extra payoff'))!
    const card = plan.categories.find((c) => c.name === 'Visa')!
    expect(extra.expenseCategories).toEqual(['Debt'])
    const r = spendByLine({ plan, spendingByEnum: { Debt: 300 }, debtPaid: { d1: 300 }, debtLedgerPaid: { d1: 300 } })
    expect(r.byLine[card.id]).toBe(300)
    expect(r.byLine[extra.id]).toBe(0)
  })
})
