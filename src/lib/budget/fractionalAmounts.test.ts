import { describe, it, expect } from 'vitest'
import { buildPlan } from '@/lib/budget/engine'
import { applyAnswers } from '@/lib/budget/flow/toFacts'
import type { BudgetFacts } from '@/lib/budget/facts'

const BLANK: BudgetFacts = {
  baseCurrency: 'EGP' as BudgetFacts['baseCurrency'], country: 'Egypt', monthlyIncome: 30000, incomeStability: 'fixed', incomeFloor: null, household: 'solo', dependents: 0,
  supportsOthers: false, housing: null, rent: null, rentIncludesUtilities: false, lifestyle: 'balanced', foodFrequency: null, transportMode: null, hasCar: false,
  bills: [], subscriptionsMonthly: 0, subscriptionCount: 0, debts: [], goals: [], liquidSavings: 0, essentialsMonthly: null, emergencyTargetMonths: 3,
  zakatMonthly: 0, averages: {}, priorities: [], securityLean: 50, investInterest: false,
}
const frac = (p: ReturnType<typeof buildPlan>) => p.lines.filter((l) => !Number.isInteger(l.amount)).map((l) => [l.name, l.amount])

describe('decimal answers reach the plan as whole line amounts', () => {
  it('investMonthly 1250.5 -> Investing line and Buffer stay whole numbers', () => {
    const f = applyAnswers(BLANK, { income: 30000, housing: 'rent', rent: 6000, savingsOnHand: 200000, investing: 'already', investMonthly: 1250.5 }, 'mixed')
    expect(frac(buildPlan(f))).toEqual([])
  })
  it('debtExtra above a fractional balance -> Extra payoff line stays whole', () => {
    const f = applyAnswers(BLANK, { income: 30000, housing: 'rent', rent: 6000, debtKinds: ['card'], cardPayFull: false, cardBalance: 1234.56, cardMin: 200, cardApr: 'over25', debtExtra: 5000 }, 'debt')
    expect(frac(buildPlan(f))).toEqual([])
  })
})
