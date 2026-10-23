import { describe, expect, it } from 'vitest'
import { buildPlan } from '@/lib/budget/engine'
import type { BudgetFacts, FactDebt } from '@/lib/budget/facts'
import {
  answersToProfilePatch,
  answerSource,
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
  investInterest: false,
}

const debt = (id: string, balance = 1000): FactDebt => ({
  id,
  name: id,
  minimum: 50,
  balance,
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
  it('blank user starts with a short, capped queue', () => {
    const n = ids(blank).length
    expect(n).toBeGreaterThanOrEqual(6)
    expect(n).toBeLessThanOrEqual(10)
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
  it('dependents only for family', () => {
    expect(ids(rich)).not.toContain('dependents')
    expect(ids(blank, applyAnswer(createState(), 'household', 'family'))).toContain('dependents')
  })

  it('rent questions need rent or own housing', () => {
    expect(ids(blank)).not.toContain('rent')
    expect(ids(blank, applyAnswer(createState(), 'housing', 'own'))).toContain('rent')
    expect(ids(blank, applyAnswer(createState(), 'housing', 'family'))).not.toContain('rent')
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
    expect(r0.missingRequired).toEqual(['housing', 'household'])
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
    expect(skipQuestion(s, 'income')).not.toBe(s)
  })

  it('skips optional and reports important as estimated', () => {
    let s = skipQuestion(createState(), 'investInterest')
    s = skipQuestion(s, 'lifestyle')
    expect(ids(blank, s)).not.toContain('lifestyle')
    const r = readiness(blank, s)
    expect(r.estimated).toEqual(['lifestyle'])
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
    s = applyAnswer(s, 'income', 4200)
    const m = mergeFacts(blank, s)
    expect(m.household).toBe('family')
    expect(m.dependents).toBe(3)
    expect(m.monthlyIncome).toBe(4200)
  })

  it('derives hasCar from transport', () => {
    expect(mergeFacts({ ...blank, hasCar: true }, applyAnswer(createState(), 'transportMode', 'public')).hasCar).toBe(false)
    expect(mergeFacts(blank, applyAnswer(createState(), 'transportMode', 'car')).hasCar).toBe(true)
    expect(mergeFacts({ ...blank, hasCar: true }, createState()).hasCar).toBe(true)
  })

  it('ignores answers to questions that no longer exist (drafts saved before the debt questions went)', () => {
    const base = { ...blank, debts: [debt('d1')] }
    const s = applyAnswer(applyAnswer(createState(), 'debtApr:d1', 9), 'payoffStrategy', 'snowball')
    expect(mergeFacts(base, s)).toEqual(base)
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
    while (visibleQuestions(blank, s)[0]?.stage === 'found') s = applyAnswer(s, visibleQuestions(blank, s)[0].id, 1)
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

/** Answers a person would plausibly give, so a whole run can be walked in a test. */
function walk(f: BudgetFacts, answerFor: (id: string, control: string) => unknown = () => undefined) {
  let s = createState()
  const asked: string[] = []
  for (let i = 0; i < 40; i++) {
    const q = visibleQuestions(f, s)[0]
    if (!q) break
    const given = answerFor(q.id, q.control)
    const value =
      given !== undefined ? given
        : q.control === 'chips' || q.control === 'single' ? q.options![0].value
          : q.control === 'toggle' || q.control === 'confirm' ? true
            : q.control === 'amount' ? 1000
              : q.control === 'stepper' ? (q.suggest?.(f) ?? q.min ?? 0)
                : q.control === 'slider' ? 50
                  : []
    if (q.control !== 'confirm') asked.push(q.id)
    s = applyAnswer(s, q.id, value)
  }
  return { s, asked }
}

describe('adaptive flow', () => {
  it('a blank user who says yes to everything still finishes within a dozen questions and can build', () => {
    const { s, asked } = walk(blank)
    expect(asked.length).toBeLessThanOrEqual(13)
    expect(asked).toEqual(expect.arrayContaining(['housing', 'household']))
    expect(readiness(blank, s).canBuild).toBe(true)
    expect(visibleQuestions(blank, s)).toHaveLength(0)
  })

  it('a user with data is only asked the gaps', () => {
    const { asked } = walk(rich)
    expect(asked.length).toBeLessThanOrEqual(8)
    expect(asked).not.toContain('hasDebts')
    expect(asked).not.toContain('hasGoal')
  })

  it('the answers of a blank run always produce a plan that sums to its income', () => {
    for (const income of [0, 3000, 25000]) {
      const f = { ...blank, monthlyIncome: income, country: 'Egypt', baseCurrency: 'EGP' as const }
      const { s } = walk(f, (id) => (id === 'income' ? income : undefined))
      const plan = buildPlan(mergeFacts(f, s))
      const total = plan.lines.reduce((sum, l) => sum + l.amount, 0)
      expect(Math.abs(plan.income - total)).toBeLessThanOrEqual(Math.max(1, plan.income * 0.002) + plan.lines.length)
      for (const l of plan.lines) expect(l.amount).toBeGreaterThanOrEqual(0)
    }
  })

  it('skipping income is allowed and leads to a spend-based plan', () => {
    const s = skipQuestion(createState(), 'income')
    expect(ids(blank, s)).not.toContain('income')
    const plan = buildPlan({ ...mergeFacts({ ...blank, country: 'Egypt', baseCurrency: 'EGP' }, s), housing: 'family' })
    expect(plan.basis).toBe('spend')
  })

  it('variable income asks for a slow month only when it is not already known', () => {
    const variable = { ...rich, monthlyIncome: 5000, incomeStability: 'variable' as const, incomeFloor: null }
    expect(ids(variable)).toContain('lowMonth')
    expect(ids({ ...variable, incomeFloor: 3000 })).not.toContain('lowMonth')
    expect(ids({ ...variable, incomeStability: 'fixed' })).not.toContain('lowMonth')
    expect(mergeFacts(variable, applyAnswer(createState(), 'lowMonth', 2800)).incomeFloor).toBe(2800)
  })

  it('asks about a rent that disagrees with the records, and honours the choice', () => {
    const f = { ...rich, rent: 8000, ledgerRent: 6000 }
    expect(ids(f)).toContain('rentCheck')
    expect(ids({ ...f, ledgerRent: 7500 })).not.toContain('rentCheck')
    expect(ids({ ...f, ledgerRent: undefined })).not.toContain('rentCheck')
    expect(mergeFacts(f, applyAnswer(createState(), 'rentCheck', 'records')).rent).toBe(6000)
    expect(mergeFacts(f, applyAnswer(createState(), 'rentCheck', 'stated')).rent).toBe(8000)
    expect(ids(f, applyAnswer(createState(), 'rentCheck', 'records'))).not.toContain('rentCheck')
  })

  it('debt answers become an amount-only debt and do not trigger the "found debts" card', () => {
    const f = { ...blank, monthlyIncome: 5000 }
    let s = applyAnswer(createState(), 'hasDebts', true)
    expect(ids(f, s)).toEqual(expect.arrayContaining(['debtTotal', 'debtMonthly']))
    s = applyAnswer(applyAnswer(s, 'debtTotal', 9000), 'debtMonthly', 450)
    const merged = mergeFacts(f, s)
    expect(merged.debts).toEqual([{ id: 'answered-debt', name: 'Debts', minimum: 450, balance: 9000, kind: 'personal' }])
    expect(ids(f, s)).not.toContain('confirmDebts')
    expect(mergeFacts(f, applyAnswer(createState(), 'hasDebts', false)).debts).toEqual([])
  })

  it('a goal answer becomes a monthly amount from cost and months', () => {
    let s = applyAnswer(createState(), 'hasGoal', true)
    s = applyAnswer(applyAnswer(s, 'goalTarget', 12000), 'goalMonths', 10)
    const g = mergeFacts(blank, s).goals[0]
    expect(g).toMatchObject({ id: 'answered-goal', monthly: 1200, targetAmount: 12000 })
    s = applyAnswer(s, 'goalMonths', 24)
    expect(mergeFacts(blank, s).goals[0].monthly).toBe(500)
  })

  it('unlocked follow-ups are never cut by the question cap', () => {
    let s = createState()
    for (const id of ['housing', 'household', 'income', 'incomeStability', 'lifestyle', 'foodFrequency', 'transportMode', 'savingsOnHand', 'emergencyMonths']) {
      s = applyAnswer(s, id, id === 'housing' ? 'family' : id === 'household' ? 'solo' : 100)
    }
    s = applyAnswer(s, 'hasDebts', true)
    expect(ids(blank, s)).toEqual(expect.arrayContaining(['debtTotal', 'debtMonthly']))
  })

  it('cash spending is only asked when there is history to distrust', () => {
    expect(ids(blank)).not.toContain('cashHeavy')
    expect(QUESTIONS.find((x) => x.id === 'cashHeavy')!.askIf({ ...blank, averages: { groceries: 800 } }, createState())).toBe(true)
    expect(QUESTIONS.find((x) => x.id === 'cashHeavy')!.askIf(blank, createState())).toBe(false)
  })

  it('reports where each value came from and when the plan is good enough', () => {
    let s = createState()
    expect(answerSource(blank, s, 'housing')).toBe('unknown')
    s = applyAnswer(s, 'housing', 'rent')
    expect(answerSource(blank, s, 'housing')).toBe('user')
    s = skipQuestion(s, 'lifestyle')
    expect(answerSource(blank, s, 'lifestyle')).toBe('estimate')
    expect(answerSource(rich, createState(), 'foodFrequency')).toBe('data')
    expect(readiness(blank, createState()).enough).toBe(false)
    expect(readiness(rich, createState()).percent).toBeGreaterThan(readiness(blank, createState()).percent)
    const { s: done } = walk(blank)
    expect(readiness(blank, done).enough).toBe(true)
  })

  it('choosing the records for rent corrects the saved rent; keeping the entered one changes nothing', () => {
    const f = { ...rich, rent: 8000, ledgerRent: 6000.4 }
    expect(answersToProfilePatch(applyAnswer(createState(), 'rentCheck', 'records'), f).profile).toEqual({ monthlyRent: 6000 })
    expect(answersToProfilePatch(applyAnswer(createState(), 'rentCheck', 'stated'), f).profile).toEqual({})
    expect(answersToProfilePatch(applyAnswer(createState(), 'rentCheck', 'records')).profile).toEqual({})
  })

  it('costs described in words become facts the engine plans with, as bills', () => {
    const merged = mergeFacts(blank, applyAnswer(createState(), 'commitments', [{ name: 'School fees', amount: 2500 }]))
    expect(merged.extraCommitments).toEqual([{ name: 'School fees', amount: 2500 }])
    const plan = buildPlan({ ...merged, country: 'Egypt', baseCurrency: 'EGP', monthlyIncome: 30000 })
    expect(plan.lines.find((l) => l.name === 'School fees')).toMatchObject({ block: 'bills', amount: 2500, essential: true })
    expect(mergeFacts(blank, createState()).extraCommitments).toBeUndefined()
  })
})

