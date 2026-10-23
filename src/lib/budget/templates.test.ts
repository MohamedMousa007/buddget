import { describe, it, expect } from 'vitest'
import { BUILD_TEMPLATES, findAdded, suggestionsByBlock, suggestionToCategory, templateDraft } from '@/lib/budget/templates'
import type { BudgetFacts } from '@/lib/budget/facts'

const facts: BudgetFacts = {
  baseCurrency: 'AED', country: 'UAE', monthlyIncome: 15000, incomeStability: 'fixed', incomeFloor: null,
  household: 'solo', dependents: 0, supportsOthers: false, housing: 'rent', rent: 4500, rentIncludesUtilities: false,
  lifestyle: 'balanced', foodFrequency: null, transportMode: 'public', hasCar: false,
  bills: [{ name: 'Phone', amount: 200, dueDay: 5, icon: 'smartphone', essential: true }],
  subscriptionsMonthly: 150, subscriptionCount: 4,
  debts: [{ id: 'd1', name: 'Card', minimum: 300, balance: 9000, kind: 'credit_card' }],
  goals: [], liquidSavings: 0, essentialsMonthly: null, emergencyTargetMonths: 3, zakatMonthly: 0,
  averages: {}, priorities: [], securityLean: 50, investInterest: false,
}

const savings = (d: ReturnType<typeof templateDraft>) =>
  d.lines.filter((l) => l.isSavings).reduce((s, l) => s + l.amount, 0)

describe('templates', () => {
  it('every template builds a plan that fits income', () => {
    for (const t of BUILD_TEMPLATES) {
      const d = templateDraft(facts, t)
      expect(d.lines.reduce((s, l) => s + l.amount, 0)).toBeLessThanOrEqual(d.income)
    }
  })

  it('saver saves more than essentials-first; debt crusher keeps the debt-first intent', () => {
    expect(savings(templateDraft(facts, 'saver'))).toBeGreaterThan(savings(templateDraft(facts, 'essentials')))
    expect(templateDraft(facts, 'debt').intent).toBe('debt_crusher')
  })

  it('groups suggestions by block and finds what is already added', () => {
    const d = templateDraft(facts, 'mine')
    const by = suggestionsByBlock(d)
    expect(by.bills.length).toBeGreaterThan(0)
    const rent = by.bills.find((l) => l.name === 'Rent')!
    const cat = suggestionToCategory(rent, 'x', 'AED')
    expect(findAdded([cat], 'bills', rent)?.id).toBe('x')
    expect(findAdded([], 'bills', rent)).toBeUndefined()
    const debt = by.debts[0]
    expect(findAdded([suggestionToCategory(debt, 'y', 'AED')], 'debts', debt)?.id).toBe('y')
  })
})
