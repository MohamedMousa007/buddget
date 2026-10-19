import { describe, expect, it } from 'vitest'
import type { BudgetFacts, FactDebt } from '@/lib/budget/facts'
import {
  answersToProfilePatch,
  applyAnswer,
  createState,
  currentStage,
  defaultValue,
  mergeFacts,
  QUESTIONS,
  readiness,
  skipQuestion,
  visibleQuestions,
} from '@/lib/budget/infoGaps'

const blank: BudgetFacts = {
  baseCurrency: 'USD' as BudgetFacts['baseCurrency'],
  country: null,
  monthlyIncome: 0,
  incomeStability: 'fixed',
  incomeFloor: null,
  household: 'solo',
  dependents: 0,
  supportsOthers: false,
  housing: null,
  rent: null,
  rentIncludesUtilities: false,
  lifestyle: 'balanced',
  foodFrequency: null,
  transportMode: null,
  hasCar: false,
  bills: [],
  subscriptionsMonthly: 0,
  subscriptionCount: 0,
  debts: [],
  goals: [],
  liquidSavings: 0,
  essentialsMonthly: null,
  emergencyTargetMonths: 3,
  zakatMonthly: 0,
  averages: {},
  priorities: [],
  securityLean: 50,
  payoffStrategy: 'avalanche',
  investInterest: false,
}

const debt = (id: string, apr: number | null, balance = 1000): FactDebt => ({
  id,
  name: id,
  minimum: 50,
  balance,
  apr,
  kind: 'loan',
})

const rich: BudgetFacts = {
  ...blank,
  monthlyIncome: 5000,
  incomeFloor: 4500,
  incomeStability: 'mixed',
  household: 'couple',
  housing: 'rent',
  rent: 1200,
  foodFrequency: 'mostdays',
  transportMode: 'public',
  bills: [{ name: 'Rent', amount: 1200, dueDay: 1, icon: 'home', essential: true }],
  subscriptionCount: 3,
  debts: [debt('d1', 6)],
  goals: [{ id: 'g1', name: 'Trip', monthly: 100, targetAmount: 2000, saved: 0, targetDate: null, priority: 1, icon: 'plane' }],
  priorities: ['safety'],
}

const ids = (f: BudgetFacts, s = createState()) => visibleQuestions(f, s).map((x) => x.id)

describe('question counts', () => {
  it('blank user sees 12-18 questions', () => {
    const n = ids(blank).length
    expect(n).toBeGreaterThanOrEqual(12)
    expect(n).toBeLessThanOrEqual(18)
  })

  it('data-rich user sees only a handful', () => {
    const asked = visibleQuestions(rich, createState())
    expect(asked.filter((x) => x.control === 'confirm')).toHaveLength(4)
    expect(asked.filter((x) => x.control !== 'confirm').length).toBeLessThanOrEqual(8)
  })

  it('orders by stage', () => {
    const stages = visibleQuestions(blank, createState()).map((x) => x.stage)
    const order = ['found', 'home', 'life', 'debts', 'secure', 'priorities']
    expect(stages.map((s) => order.indexOf(s))).toEqual([...stages.map((s) => order.indexOf(s))].sort((a, b) => a - b))
  })

  it('has unique ids with i18n keys only', () => {
    expect(new Set(QUESTIONS.map((x) => x.id)).size).toBe(QUESTIONS.length)
    expect(QUESTIONS.every((x) => x.labelKey.startsWith('budget.studio.q.'))).toBe(true)
  })
})

describe('askIf rules', () => {
  it('car sub-question only when driving', () => {
    expect(ids(rich)).not.toContain('carCosts')
    expect(ids({ ...rich, hasCar: true })).toContain('carCosts')
    const s = applyAnswer(createState(), 'transportMode', 'car')
    expect(ids(blank, s)).toContain('carCosts')
  })

  it('dependents only for family', () => {
    expect(ids(rich)).not.toContain('dependents')
    expect(ids(blank, applyAnswer(createState(), 'household', 'family'))).toContain('dependents')
  })

  it('rent questions need rent or own housing', () => {
    expect(ids(blank)).not.toContain('rent')
    expect(ids(blank, applyAnswer(createState(), 'housing', 'own'))).toContain('rent')
    expect(ids(blank, applyAnswer(createState(), 'housing', 'family'))).not.toContain('rent')
  })

  it('APR asked once per debt with unknown rate', () => {
    const f = { ...rich, debts: [debt('a', null), debt('b', 8), debt('c', null)] }
    const got = ids(f).filter((i) => i.startsWith('debtApr:'))
    expect(got).toEqual(['debtApr:a', 'debtApr:c'])
    expect(ids(f, applyAnswer(createState(), 'debtApr:a', 20))).not.toContain('debtApr:a')
  })

  it('payoff only when high APR or several debts with balance', () => {
    expect(ids(rich)).not.toContain('payoffStrategy')
    expect(ids({ ...rich, debts: [debt('a', 24)] })).toContain('payoffStrategy')
    expect(ids({ ...rich, debts: [debt('a', 5), debt('b', 6)] })).toContain('payoffStrategy')
    expect(ids({ ...rich, debts: [debt('a', 5), debt('b', 6, 0)] })).toContain('payoffStrategy')
    expect(ids({ ...rich, debts: [debt('a', 5, 0), debt('b', 6, 0)] })).not.toContain('payoffStrategy')
  })

  it('income amount only when income unknown, confirm only when known', () => {
    expect(ids(blank)).toContain('income')
    expect(ids(blank)).not.toContain('confirmIncome')
    expect(ids(rich)).toContain('confirmIncome')
    expect(ids(rich)).not.toContain('income')
  })

  it('removes answered questions', () => {
    expect(ids(blank, applyAnswer(createState(), 'housing', 'rent'))).not.toContain('housing')
  })
})

describe('readiness', () => {
  it('locks build on a blank user until required are answered', () => {
    let s = createState()
    const r0 = readiness(blank, s)
    expect(r0.canBuild).toBe(false)
    expect(r0.missingRequired).toEqual(['income', 'housing', 'household'])
    s = applyAnswer(s, 'income', 3000)
    s = applyAnswer(s, 'housing', 'family')
    expect(readiness(blank, s).canBuild).toBe(false)
    s = applyAnswer(s, 'household', 'solo')
    const r = readiness(blank, s)
    expect(r.canBuild).toBe(true)
    expect(r.percent).toBeGreaterThan(r0.percent)
  })

  it('rent and utilities become required after choosing rent', () => {
    const s = applyAnswer(createState(), 'housing', 'rent')
    expect(readiness(blank, s).missingRequired).toContain('rent')
  })

  it('required known from facts count as satisfied', () => {
    const r = readiness({ ...rich, rent: 1200 }, createState())
    expect(r.missingRequired).toEqual(['rentIncludesUtilities'])
    expect(readiness({ ...rich, rent: 1200 }, applyAnswer(createState(), 'rentIncludesUtilities', true)).canBuild).toBe(true)
  })

  it('reaches 100% when everything is answered', () => {
    let s = createState()
    for (const x of visibleQuestions(blank, s)) s = applyAnswer(s, x.id, true)
    for (const x of visibleQuestions(blank, s)) s = applyAnswer(s, x.id, true)
    expect(readiness(blank, s).percent).toBe(100)
  })
})

describe('skipping', () => {
  it('refuses required questions', () => {
    const s = createState()
    expect(skipQuestion(s, 'housing')).toBe(s)
    expect(skipQuestion(s, 'income')).toBe(s)
  })

  it('skips optional and reports important as estimated', () => {
    let s = skipQuestion(createState(), 'investInterest')
    s = skipQuestion(s, 'lifestyle')
    expect(ids(blank, s)).not.toContain('lifestyle')
    const r = readiness(blank, s)
    expect(r.estimated).toEqual(['lifestyle'])
  })

  it('dynamic APR questions are skippable and estimated', () => {
    const f = { ...rich, debts: [debt('a', null)] }
    const s = skipQuestion(createState(), 'debtApr:a')
    expect(readiness(f, s).estimated).toContain('debtApr:a')
  })

  it('answering un-skips', () => {
    const s = applyAnswer(skipQuestion(createState(), 'lifestyle'), 'lifestyle', 'minimal')
    expect(s.skipped).toEqual([])
  })
})

describe('immutability', () => {
  it('applyAnswer and skipQuestion return new state', () => {
    const s = createState()
    const a = applyAnswer(s, 'housing', 'rent')
    const k = skipQuestion(s, 'lifestyle')
    expect(s).toEqual(createState())
    expect(a).not.toBe(s)
    expect(k).not.toBe(s)
    expect(s.answers).not.toBe(a.answers)
    expect(s.skipped).not.toBe(k.skipped)
  })
})

describe('answersToProfilePatch', () => {
  it('splits profile and financial writes', () => {
    let s = createState()
    s = applyAnswer(s, 'household', 'family')
    s = applyAnswer(s, 'rent', 900)
    s = applyAnswer(s, 'rentIncludesUtilities', true)
    s = applyAnswer(s, 'foodFrequency', 'rarely')
    s = applyAnswer(s, 'lifestyle', 'minimal')
    s = applyAnswer(s, 'transportMode', 'car')
    s = applyAnswer(s, 'emergencyMonths', 6)
    s = applyAnswer(s, 'housing', 'rent')
    s = applyAnswer(s, 'dependents', 2)
    s = applyAnswer(s, 'supportsOthers', true)
    s = applyAnswer(s, 'securityLean', 35)
    s = applyAnswer(s, 'priorities', ['safety', 'debt'])
    s = applyAnswer(s, 'carCosts', ['fuel'])
    s = applyAnswer(s, 'confirmIncome', true)
    const { profile, financial } = answersToProfilePatch(s)
    expect(profile).toEqual({
      household: 'family',
      monthlyRent: 900,
      rentIncludesUtilities: true,
      foodFrequency: 'rarely',
      lifestyleTier: 'minimal',
      transportMode: 'car',
      emergencyFundConfig: { targetMonths: 6 },
    })
    expect(financial).toEqual({
      housing: 'rent',
      dependents: 2,
      supportsOthers: true,
      securityLean: 35,
      priorities: ['safety', 'debt'],
    })
  })

  it('is empty for a fresh state', () => {
    expect(answersToProfilePatch(createState())).toEqual({ profile: {}, financial: {} })
  })
})

describe('mergeFacts', () => {
  it('answers override facts', () => {
    let s = applyAnswer(createState(), 'household', 'family')
    s = applyAnswer(s, 'dependents', 3)
    s = applyAnswer(s, 'debtApr:d1', 22)
    s = applyAnswer(s, 'income', 4200)
    const m = mergeFacts({ ...blank, debts: [debt('d1', null)] }, s)
    expect(m.household).toBe('family')
    expect(m.dependents).toBe(3)
    expect(m.debts[0].apr).toBe(22)
    expect(m.monthlyIncome).toBe(4200)
  })

  it('derives hasCar from transport', () => {
    expect(mergeFacts({ ...blank, hasCar: true }, applyAnswer(createState(), 'transportMode', 'public')).hasCar).toBe(false)
    expect(mergeFacts(blank, applyAnswer(createState(), 'transportMode', 'car')).hasCar).toBe(true)
    expect(mergeFacts({ ...blank, hasCar: true }, createState()).hasCar).toBe(true)
  })

  it('does not mutate the base facts', () => {
    const base = { ...blank, debts: [debt('d1', null)] }
    mergeFacts(base, applyAnswer(createState(), 'debtApr:d1', 9))
    expect(base.debts[0].apr).toBeNull()
  })
})

describe('defaults and stage', () => {
  it('suggests 6 months for variable income or dependents', () => {
    const x = QUESTIONS.find((q) => q.id === 'emergencyMonths')!
    expect(defaultValue(x, blank, createState())).toBe(3)
    expect(defaultValue(x, blank, applyAnswer(createState(), 'incomeStability', 'variable'))).toBe(6)
    expect(defaultValue(x, { ...blank, dependents: 1 }, createState())).toBe(6)
  })

  it('slider defaults to 35 for safety or debt priorities, else 50', () => {
    const x = QUESTIONS.find((q) => q.id === 'securityLean')!
    expect(defaultValue(x, blank, createState())).toBe(50)
    expect(defaultValue(x, blank, applyAnswer(createState(), 'priorities', ['debt']))).toBe(35)
  })

  it('current stage follows the first open question', () => {
    expect(currentStage(rich, createState())).toBe('found')
    expect(currentStage(blank, createState())).toBe('found')
    let s = createState()
    for (const x of visibleQuestions(blank, s).filter((x) => x.stage === 'found')) s = applyAnswer(s, x.id, 1)
    expect(currentStage(blank, s)).toBe('home')
  })
})

describe('known fields skip questions the profile already answers', () => {
  it('stops asking lifestyle, rent utilities and household once they are stored values', () => {
    expect(ids(rich)).toContain('lifestyle')
    const withKnown: BudgetFacts = { ...rich, known: new Set(['lifestyle', 'rentIncludesUtilities', 'household']) }
    expect(ids(withKnown)).not.toContain('lifestyle')
    expect(ids(withKnown)).not.toContain('rentIncludesUtilities')
    expect(ids(withKnown)).not.toContain('household')
  })
})
