import { describe, expect, it } from 'vitest'
import { applyAnswers, stableSnapshot } from './toFacts'
import type { BudgetFacts } from '@/lib/budget/facts'

const base: BudgetFacts = {
  baseCurrency: 'EGP' as BudgetFacts['baseCurrency'], country: 'Egypt', monthlyIncome: 20000, incomeStability: 'fixed', incomeFloor: null, household: 'solo', dependents: 0,
  supportsOthers: false, housing: null, rent: null, rentIncludesUtilities: false, lifestyle: 'balanced', foodFrequency: null, transportMode: null, hasCar: false,
  bills: [], subscriptionsMonthly: 0, subscriptionCount: 0, debts: [], goals: [], liquidSavings: 0, essentialsMonthly: null, emergencyTargetMonths: 3,
  zakatMonthly: 0, averages: {}, priorities: [], securityLean: 50, investInterest: false,
}

describe('applyAnswers', () => {
  it('turns quarterly rent into a monthly cost, and a partner share into your share', () => {
    const f = applyAnswers(base, { housing: 'rent', rent: 18000, rentFreq: 'quarterly', partnerRole: 'shares', partnerSharePct: 50 })
    expect(f.rent).toBe(3000)
  })
  it('applies a partner share to a rent the app already holds, once', () => {
    const f = applyAnswers({ ...base, housing: 'rent', rent: 6000 }, { partnerRole: 'shares', partnerSharePct: 50 })
    expect(f.rent).toBe(3000)
  })
  it('never invents a rent for an owner', () => {
    expect(applyAnswers(base, { housing: 'own', ownType: 'paid_off' }).rent).toBeNull()
    expect(applyAnswers(base, { housing: 'own', ownType: 'mortgage', mortgagePayment: 7000 }).rent).toBe(7000)
  })
  it('keeps the tracked facts when an answer is absent', () => {
    const f = applyAnswers({ ...base, rent: 4000, housing: 'rent' }, { lifestyle: 'minimal' })
    expect(f.rent).toBe(4000)
    expect(f.monthlyIncome).toBe(20000)
  })
  it('does not ask a self-employed person for a tax rate they gave, or set one they covered', () => {
    expect(applyAnswers(base, { incomeType: 'freelance', taxSetAside: 'not_yet', taxPct: 22 }).taxReservePct).toBe(0.22)
    expect(applyAnswers(base, { incomeType: 'freelance', taxSetAside: 'already' }).taxReservePct).toBe(0)
    expect(applyAnswers(base, { incomeType: 'salary' }).taxReservePct).toBeUndefined()
  })
  it('turns each kind of debt into a record with its own rate, and skips a card paid in full', () => {
    const f = applyAnswers(base, { debtKinds: ['card', 'loan'], cardPayFull: true, loanBalance: 50000, loanMin: 2000, loanApr: 'over25' })
    expect(f.debts.map((d) => d.id)).toEqual(['answered-loan'])
    expect(f.debts[0].apr).toBe(30)
  })
  it('plans a goal from a date or from a monthly amount, and a big expense coming soon', () => {
    const f = applyAnswers(base, { goalTarget: 120000, goalSaved: 0, goalTiming: 'by_date', goalMonths: 24, bigSoon: ['baby'], bigSoonAmount: 30000, bigSoonMonths: 10 })
    expect(f.goals.find((g) => g.id === 'answered-goal-1')?.monthly).toBe(5000)
    expect(f.goals.find((g) => g.id === 'answered-goal-soon')?.monthly).toBe(3000)
  })
  it('treats the chosen starting point as a stated priority', () => {
    expect(applyAnswers(base, {}, 'debt').priorities).toContain('debt')
    expect(applyAnswers(base, { priorities: ['safety'] }, 'goal').priorities).toEqual(['goals', 'safety'])
  })
  it('remembers stable answers only, never balances', () => {
    const s = stableSnapshot({ housing: 'rent', rent: 5000, loanBalance: 90000, incomeType: 'salary', arrears: 400 })
    expect(s).toEqual({ housing: 'rent', incomeType: 'salary' })
  })
})
