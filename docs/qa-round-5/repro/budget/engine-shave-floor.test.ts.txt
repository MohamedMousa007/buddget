import { describe, it, expect } from 'vitest'
import { buildPlan } from '@/lib/budget/engine'
import type { BudgetFacts, PlanDraft } from '@/lib/budget/facts'

const base: BudgetFacts = {
  baseCurrency: 'AED', country: 'UAE', monthlyIncome: 15000, incomeStability: 'fixed', incomeFloor: null, household: 'solo', dependents: 0,
  supportsOthers: false, housing: 'rent', rent: 4500, rentIncludesUtilities: false, lifestyle: 'balanced', foodFrequency: null, transportMode: 'public', hasCar: false,
  bills: [], subscriptionsMonthly: 0, subscriptionCount: 0, debts: [], goals: [], liquidSavings: 0, essentialsMonthly: null, emergencyTargetMonths: 3,
  zakatMonthly: 0, averages: {}, priorities: [], securityLean: 50, investInterest: false,
}
const amt = (p: PlanDraft, n: string) => p.lines.find((l) => l.name === n)?.amount ?? 0
const ev = (p: PlanDraft) => Object.fromEntries(p.lines.filter((l) => l.block === 'everyday').map((l) => [l.name, l.amount]))

describe('shave: everyday line whose target is below its floor', () => {
  it('a saving target must never raise an everyday line above its target', () => {
    const learned = { v: 1 as const, everyday: { groceries: { mult: 0.6, n: 3 }, transport: { mult: 0.6, n: 3 }, health: { mult: 0.6, n: 3 } } }
    const out: string[] = []
    for (const income of [6000, 8000, 10000, 15000, 25000]) {
      for (const pct of [0.5, 0.6]) {
        const f: BudgetFacts = { ...base, monthlyIncome: income, rent: Math.round(income * 0.4), saveTargetPct: pct, learned, liquidSavings: 100000, averages: { fun: 0, shopping: 0, dining: 0, other: 0, family: 0 } }
        const noTarget = buildPlan({ ...f, saveTargetPct: undefined })
        const p = buildPlan(f)
        const before = ev(noTarget), after = ev(p)
        for (const k of Object.keys(after)) if (after[k] > before[k]) out.push(`inc ${income} pct ${pct} ${k}: ${before[k]} -> ${after[k]}`)
      }
    }
    expect(out).toEqual([])
  })
})
