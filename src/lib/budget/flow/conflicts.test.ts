import { describe, expect, it } from 'vitest'
import type { BudgetFacts } from '@/lib/budget/facts'
import { buildPlan } from '@/lib/budget/engine'
import { ANSWERABLE, parseSituation } from '@/lib/budget/situationAi'
import { resumeStudioDraft } from '@/lib/budget/studioDraft'
import type { FinancialProfile } from '@/lib/store/types'
import { amountsDiffer, choose, detectConflicts, nextConflict, pendingFor, resolveDescription } from './conflicts'
import { get } from './derive'
import { acceptDescribed, applyScreen, createFlow, nextQuestion } from './flow'
import { knownFromStore, knownSources } from './known'
import { NODE_BY_ID } from './nodes'
import { profilePatch } from './profile'
import { applyAnswers } from './toFacts'
import type { FlowValue } from './types'
import { planRecords } from '@/lib/budget/studioPreview'

const base: BudgetFacts = {
  baseCurrency: 'EGP' as BudgetFacts['baseCurrency'], country: 'Egypt', monthlyIncome: 0, incomeStability: 'fixed', incomeFloor: null, household: 'solo', dependents: 0,
  supportsOthers: false, housing: null, rent: null, rentIncludesUtilities: false, lifestyle: 'balanced', foodFrequency: null, transportMode: null, hasCar: false,
  bills: [], subscriptionsMonthly: 0, subscriptionCount: 0, debts: [], goals: [], liquidSavings: 0, essentialsMonthly: null, emergencyTargetMonths: 3,
  zakatMonthly: 0, averages: {}, priorities: [], securityLean: 50, investInterest: false,
}
const debt = { id: 'd1', name: 'Car loan', kind: 'loan', balance: 40000, minimum: 2000 } as unknown as BudgetFacts['debts'][number]

/** A run started the way the studio starts one: from what the store holds. */
const runFrom = (f: Partial<BudgetFacts>, fp: FinancialProfile | null = null) => {
  const facts = { ...base, ...f }
  return { s: createFlow('mixed', knownFromStore(facts, fp)), sources: knownSources(facts, fp) }
}
const describe1 = (raw: Record<string, unknown>, f: Partial<BudgetFacts> = {}, fp: FinancialProfile | null = null) => {
  const { s, sources } = runFrom(f, fp)
  const found = parseSituation(raw)
  return { s, found, conflicts: detectConflicts(s, found, sources) }
}

function sample(id: string): FlowValue {
  const x = NODE_BY_ID.get(id)!
  if (x.control === 'amount') return 5000
  if (x.control === 'stepper') return (x.min ?? 0) + 1
  if (x.control === 'toggle') return true
  if (x.control === 'multi') return [x.opts![0]]
  return x.opts![0]
}

describe('acceptDescribed never loses an answer without saying so', () => {
  it('every answerable field is either kept or reported as dropped', () => {
    for (const id of ANSWERABLE) {
      const found = parseSituation({ [id]: sample(id) })
      const { kept, dropped } = acceptDescribed(createFlow('mixed'), found)
      for (const k of Object.keys(found)) expect([...kept, ...dropped], `${id} -> ${k}`).toContain(k)
    }
  })
  it('the fields the owner typed and lost are kept on their own', () => {
    const cases: Record<string, unknown>[] = [
      { rent: 7000 }, { mortgagePayment: 9000 }, { goalTarget: 60000, goalMonths: 18 }, { cardBalance: 9000, cardMin: 450 }, { loanBalance: 40000, loanMin: 2000 },
      { savingsOnHand: 30000 }, { holdings: [{ kind: 'gold', value: 150000 }] }, { housing: 'rent', rent: 6000, utilities: 900 },
    ]
    for (const raw of cases) {
      const found = parseSituation(raw)
      const { kept, dropped } = acceptDescribed(createFlow('mixed'), found)
      expect(dropped, JSON.stringify(raw)).toEqual([])
      expect(kept.sort()).toEqual(Object.keys(found).filter((k) => k !== 'amountCurrency').sort())
    }
  })
  it('already investing is kept even before the plan would offer investing, and survives a later edit', () => {
    const { state, kept } = acceptDescribed(createFlow('mixed'), parseSituation({ investing: 'already', investMonthly: 1500 }))
    expect(kept).toEqual(expect.arrayContaining(['investing', 'investMonthly']))
    const edited = applyScreen(state, [{ id: 'household', value: 'couple' }], true)
    expect(edited.a).toMatchObject({ investing: 'already', investMonthly: 1500 })
  })
})

describe('detectConflicts', () => {
  it('rough figures inside 10% agree; further apart they conflict', () => {
    expect(describe1({ income: 20000 }, { monthlyIncome: 21350 }).conflicts).toEqual([])
    expect(describe1({ income: 25000 }, { monthlyIncome: 21350 }).conflicts).toEqual([{ id: 'income', app: 21350, typed: 25000, source: 'tracked' }])
    expect(amountsDiffer(30000, 0, 20000)).toBe(true)
    expect(amountsDiffer(100, 104, 0)).toBe(false)
  })
  it('compares rent month for month', () => {
    const held = { housing: 'rent' as const, rent: 6000 }
    expect(describe1({ housing: 'rent', rent: 72000, rentFreq: 'yearly' }, held).conflicts).toEqual([])
    expect(describe1({ housing: 'rent', rent: 9000 }, held).conflicts.map((c) => c.id)).toEqual(['rent'])
  })
  it('names an earlier answer as earlier, not as a record', () => {
    const fp = { budgetProfile: { lifestyle: 'minimal' } } as unknown as FinancialProfile
    expect(describe1({ lifestyle: 'comfortable' }, {}, fp).conflicts).toEqual([{ id: 'lifestyle', app: 'minimal', typed: 'comfortable', source: 'earlier' }])
  })
  it('owing nothing against tracked debts, and typed debts beside tracked ones, are both asked', () => {
    expect(describe1({ hasDebts: false }, { debts: [debt] }).conflicts.map((c) => c.id)).toEqual(['hasDebts'])
    expect(describe1({ loanBalance: 40000, loanMin: 2000 }, { debts: [debt] }).conflicts).toEqual([{ id: 'moreDebts', app: 1, typed: ['loan'], source: 'tracked' }])
  })
  it('nothing in common means nothing to ask', () => {
    const { s, found } = describe1({ household: 'couple' })
    expect(pendingFor(s, found, {})).toBeNull()
  })
})

describe('resolveDescription', () => {
  const resolve = (raw: Record<string, unknown>, f: Partial<BudgetFacts>, picks: Record<string, 'app' | 'typed'>) => {
    const { s, found } = describe1(raw, f)
    let p = pendingFor(s, found, {})!
    for (const [id, c] of Object.entries(picks)) p = choose(p, id, c)
    return resolveDescription({ ...s, pending: p }, p)
  }

  it('choosing the typed income uses it and asks no confirmation', () => {
    const r = resolve({ income: 25000 }, { monthlyIncome: 20000 }, { income: 'typed' })
    expect(r.state.a.income).toBe(25000)
    expect(r.state.pending).toBeUndefined()
    expect(nextQuestion(r.state)?.id).not.toBe('confirmIncome')
  })
  it('keeping the tracked income confirms it, so it is not asked again', () => {
    const r = resolve({ income: 25000 }, { monthlyIncome: 20000 }, { income: 'app' })
    expect(r.state.a.income).toBeUndefined()
    expect(r.state.a.confirmIncome).toBe(true)
    expect(r.keptApp).toContain('income')
    expect(nextQuestion(r.state)?.id).not.toBe('confirmIncome')
  })
  it('an unanswered conflict keeps the app value (only reachable through "keep my records")', () => {
    const r = resolve({ income: 25000 }, { monthlyIncome: 20000 }, {})
    expect(get(r.state, 'income')).toBe(20000)
  })
  it('a housing choice decides which housing costs survive', () => {
    const held = { housing: 'rent' as const, rent: 6000 }
    const own = resolve({ housing: 'own', mortgagePayment: 9000 }, held, { housing: 'typed' })
    expect(own.state.a).toMatchObject({ housing: 'own', ownType: 'mortgage', mortgagePayment: 9000 })
    const rent = resolve({ housing: 'own', mortgagePayment: 9000 }, held, { housing: 'app' })
    expect(get(rent.state, 'housing')).toBe('rent')
    expect(rent.state.a.mortgagePayment).toBeUndefined()
    expect(rent.dropped).toEqual(expect.arrayContaining(['ownType', 'mortgagePayment']))
  })
  it('owing nothing, when chosen over tracked debts, drops them from the plan', () => {
    const r = resolve({ hasDebts: false }, { debts: [debt] }, { hasDebts: 'typed' })
    expect(r.state.a).toMatchObject({ confirmDebts: false, hasDebts: false })
  })
  it('typed debts are added beside tracked ones only when the person says they are extra', () => {
    const extra = resolve({ loanBalance: 40000, loanMin: 2000 }, { debts: [debt] }, { moreDebts: 'typed' })
    expect(extra.state.a).toMatchObject({ moreDebts: true, debtKinds: ['loan'], loanBalance: 40000, loanMin: 2000 })
    const same = resolve({ loanBalance: 40000, loanMin: 2000 }, { debts: [debt] }, { moreDebts: 'app' })
    expect(same.state.a.loanBalance).toBeUndefined()
    expect(same.dropped).toEqual([])
  })
})

describe('resume', () => {
  it('a draft with a pending description comes back on the picker, opener not done', () => {
    const { s, found } = describe1({ income: 25000, household: 'couple' }, { monthlyIncome: 20000 })
    const pending = pendingFor(s, found, {})!
    const draft = JSON.parse(JSON.stringify({ v: 3, intent: 'save', state: { ...s, pending }, savedAt: 1000 }))
    const back = resumeStudioDraft(draft, 'save', 2000)!
    expect(back.opener).toBeUndefined()
    expect(nextConflict(back.pending!)?.id).toBe('income')
    expect(nextConflict(choose(back.pending!, 'income', 'typed'))).toBeUndefined()
  })
})

describe('utilities and holdings in the plan', () => {
  const utilityLines = (f: BudgetFacts) => buildPlan(f).lines.filter((l) => l.expenseCategories.includes('Utilities'))
  const renter = { ...base, monthlyIncome: 20000, housing: 'rent' as const, rent: 6000 }

  it('stated utilities replace the typical figure, once', () => {
    const lines = utilityLines(applyAnswers(renter, parseSituation({ utilities: 900 })))
    expect(lines).toHaveLength(1)
    expect(lines[0].amount).toBe(900)
  })
  it('a tracked utilities bill is the only utilities line', () => {
    const bill = { name: 'Electricity', amount: 700, dueDay: 5, icon: 'zap', essential: true, expenseCategories: ['Utilities'] }
    const lines = utilityLines({ ...renter, bills: [bill] })
    expect(lines).toHaveLength(1)
    expect(lines[0].amount).toBe(700)
  })
  it('living with family, stated utilities become a cost of their own', () => {
    const f = applyAnswers({ ...base, monthlyIncome: 20000 }, { housing: 'family', utilities: 500 })
    expect(f.extraCommitments).toEqual([{ name: 'Utilities', amount: 500 }])
    expect(f.utilitiesMonthly).toBeUndefined()
  })
  it('holdings never count as cash savings', () => {
    const f = applyAnswers(base, parseSituation({ holdings: [{ kind: 'gold', value: 150000 }] }))
    expect(f.liquidSavings).toBe(0)
    expect(f.investInterest).toBe(true)
  })
})

describe('review fixes', () => {
  const pick = (raw: Record<string, unknown>, f: Partial<BudgetFacts>, fp: FinancialProfile | null, picks: Record<string, 'app' | 'typed'>) => {
    const { s, found } = describe1(raw, f, fp)
    let p = pendingFor(s, found, {}) ?? { found, conflicts: [], choices: {} }
    for (const [id, c] of Object.entries(picks)) p = choose(p, id, c)
    return { conflicts: p.conflicts.map((c) => c.id), ...resolveDescription(s, p) }
  }
  const yearly = { budgetProfile: { rentFreq: 'yearly', housing: 'rent' } } as unknown as FinancialProfile
  const remembered = (a: Record<string, FlowValue>) => ({ ...yearly.budgetProfile, ...a }) as Record<string, FlowValue>

  it('rent and its frequency are one choice; the typed rent comes with its own frequency', () => {
    const r = pick({ housing: 'rent', rent: 9000 }, { housing: 'rent', rent: 6000 }, yearly, { rent: 'typed' })
    expect(r.conflicts).toEqual(['rent'])
    expect(r.state.a).toMatchObject({ rent: 9000, rentFreq: 'monthly', housing: 'rent' })
    expect(applyAnswers({ ...base, housing: 'rent', rent: 6000 }, remembered(r.state.a)).rent).toBe(9000)
  })
  it('a renter known only from the profile rent gets the typed rent in the plan and the profile', () => {
    const r = pick({ rent: 9000 }, { housing: 'rent', rent: 6000 }, null, { rent: 'typed' })
    expect(r.state.a.housing).toBe('rent')
    expect(applyAnswers({ ...base, housing: 'rent', rent: 6000 }, r.state.a).rent).toBe(9000)
    expect(profilePatch(r.state.a).profile.monthlyRent).toBe(9000)
  })
  it('a typed rent with no conflict is never multiplied by a remembered yearly frequency', () => {
    const r = pick({ rent: 6000 }, {}, yearly, {})
    expect(r.state.a).toMatchObject({ rent: 6000, rentFreq: 'monthly', housing: 'rent' })
    expect(applyAnswers(base, remembered(r.state.a)).rent).toBe(6000)
  })
  it('"I owe nothing" and "no goal" leave tracked debts and goals out of this plan only', () => {
    const goal = { id: 'g1' } as unknown as BudgetFacts['goals'][number]
    const f = { ...base, debts: [debt], goals: [goal] }
    expect(planRecords(f, { confirmDebts: false }).debts).toEqual([])
    expect(planRecords(f, { confirmGoals: false }).goals).toEqual([])
    expect(planRecords(f, {}).debts).toEqual([debt])
    expect(planRecords(f, {}, new Set(['d1'])).debts).toEqual([])
    expect(f.debts).toHaveLength(1)
  })
  it('keeping "rent includes utilities" drops the typed utilities, and says so', () => {
    const known = new Set(['rentIncludesUtilities']) as unknown as BudgetFacts['known']
    const held = { housing: 'rent' as const, rent: 6000, rentIncludesUtilities: true, known }
    const r = pick({ housing: 'rent', rent: 6000, utilities: 800 }, held, null, { rentIncludesUtilities: 'app' })
    expect(r.conflicts).toEqual(['rentIncludesUtilities'])
    expect(r.state.a.utilities).toBeUndefined()
    expect(r.dropped).toContain('utilities')
    expect(applyAnswers({ ...base, ...held }, { utilities: 800 }).utilitiesMonthly).toBeUndefined()
  })
  it('a typed figure a little off the kept one is marked as kept records', () => {
    const r = pick({ income: 20000 }, { monthlyIncome: 21350 }, null, {})
    expect(r.conflicts).toEqual([])
    expect(r.keptRecords).toEqual(['income'])
    expect(pick({ income: 21350 }, { monthlyIncome: 21350 }, null, {}).keptRecords).toEqual([])
  })
})
