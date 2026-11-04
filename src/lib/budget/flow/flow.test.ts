import { describe, expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { answer, createFlow, MODULE_ORDER, nextQuestion, screenNodes, skip, worthAsking } from './flow'
import { NODE_BY_ID, NODES } from './nodes'
import { debtCount, fixedObligations, get, goalMonthlyNeed, hasAnyGoal, highAprDebt, housingMonthly, is, monthsHeld, num, planIncome, slack, stability } from './derive'
import { applyAnswers } from './toFacts'
import { buildPlan } from '@/lib/budget/engine'
import type { BudgetFacts, PlanDraft } from '@/lib/budget/facts'
import type { FlowIntent, FlowNode, FlowState, FlowValue } from './types'

/** Which kind of plan these answers lead to, so the validator can check every kind is reachable. */
type Archetype = 'stabilize' | 'debt_crusher' | 'safety_first' | 'goal_driven' | 'builder' | 'steady_saver'

/** Which kind of plan these answers lead to, plus the modifiers the engine would apply. */
function outcome(s: FlowState): { primary: Archetype; flags: string[] } {
  const inc = planIncome(s)
  const flags: string[] = []
  if (stability(s) !== 'fixed') flags.push('income_floor')
  if (['freelance', 'business', 'mixed', 'seasonal'].includes(String(get(s, 'incomeType')))) flags.push('tax_reserve')
  if (is(s, 'partnerRole', 'shares')) flags.push('shared_costs')
  if (is(s, 'behind', true)) flags.push('arrears')
  if (housingMonthly(s) / (inc || 1) > 0.4) flags.push('housing_strain')
  if ((get(s, 'annualKinds') as string[] | undefined)?.length) flags.push('sinking_funds')
  if (num(s, 'dependents') > 0 && !is(s, 'lifeInsurance', true)) flags.push('family_cover_gap')
  if (is(s, 'retirement', 'none')) flags.push('retirement_gap')
  if (get(s, 'zakatMode') === 'yes_auto' || get(s, 'zakatMode') === 'yes_amount') flags.push('zakat')
  if (is(s, 'goalAdjust', 'keep') && goalMonthlyNeed(s) > 0) flags.push('stretch_goal')
  if (is(s, 'healthCover', 'none')) flags.push('health_gap')
  if (is(s, 'jobSecurity', 'uncertain') || is(s, 'jobSecurity', 'expecting_change')) flags.push('job_risk')
  if (((get(s, 'bigSoon') as string[] | undefined)?.length ?? 0) > 0) flags.push('big_expense_soon')
  if (get(s, 'cutFirst')) flags.push('cut_order')

  const sl = slack(s)
  let primary: Archetype
  if (inc > 0 && (sl < 0 || fixedObligations(s) / inc > 0.85)) primary = 'stabilize'
  else if (highAprDebt(s) || (s.intent === 'debt' && debtCount(s) > 0)) primary = 'debt_crusher'
  else if (monthsHeld(s) < 1) primary = 'safety_first'
  else if (hasAnyGoal(s) && !is(s, 'goalVsSafety', 'safety_first')) primary = 'goal_driven'
  else if (monthsHeld(s) >= 3 && (is(s, 'investing', 'want_to') || is(s, 'investing', 'already'))) primary = 'builder'
  else primary = 'steady_saver'
  return { primary, flags }
}

const REPORT = process.env.FLOW_REPORT

const BLANK_FACTS: BudgetFacts = {
  baseCurrency: 'EGP' as BudgetFacts['baseCurrency'], country: 'Egypt', monthlyIncome: 0, incomeStability: 'fixed', incomeFloor: null, household: 'solo', dependents: 0,
  supportsOthers: false, housing: null, rent: null, rentIncludesUtilities: false, lifestyle: 'balanced', foodFrequency: null, transportMode: null, hasCar: false,
  bills: [], subscriptionsMonthly: 0, subscriptionCount: 0, debts: [], goals: [], liquidSavings: 0, essentialsMonthly: null, emergencyTargetMonths: 3,
  zakatMonthly: 0, averages: {}, priorities: [], securityLean: 50, investInterest: false,
}

/** What the engine does with these answers, and what real-life rules the result must obey whatever they were. */
function planFor(s: FlowState): { plan: PlanDraft; facts: BudgetFacts; broken: string[] } {
  const knownFacts: Partial<BudgetFacts> = {}
  if (typeof s.known.income === 'number') knownFacts.monthlyIncome = s.known.income
  if (typeof s.known.savingsOnHand === 'number') knownFacts.liquidSavings = s.known.savingsOnHand
  const facts = applyAnswers({ ...BLANK_FACTS, ...knownFacts }, s.a, s.intent)
  const plan = buildPlan(facts)
  const broken: string[] = []
  const total = plan.lines.reduce((x, l) => x + l.amount, 0)
  if (plan.lines.some((l) => l.amount < 0 || !Number.isFinite(l.amount))) broken.push('negative or non-finite line')
  if (plan.income > 0 && plan.free > 0) broken.push('money left unassigned')
  if (plan.income > 0 && Math.abs(plan.income - total - plan.free) > 1) broken.push('lines do not add up')
  if (plan.free < 0 && plan.risks.length === 0) broken.push('deficit with no warning')
  const saved = plan.lines.filter((l) => l.isSavings && l.name !== 'Tax reserve').reduce((x, l) => x + l.amount, 0)
  const buffer = plan.lines.find((l) => l.name === 'Buffer')?.amount ?? 0
  const essentials = plan.lines.filter((l) => l.essential && !l.isSavings).reduce((x, l) => x + l.amount, 0)
  if (plan.income > 0 && buffer > plan.income * 0.5 && facts.liquidSavings < essentials) broken.push('large buffer while the safety net is under one month')
  if (plan.income > 0 && saved / plan.income > 0.9) broken.push('saves more than 90% of income')
  const tax = plan.lines.find((l) => l.name === 'Tax reserve')?.amount ?? 0
  if (plan.income > 0 && tax / plan.income > 0.41) broken.push('tax reserve above 40%')
  if (s.a.housing === 'own' && plan.lines.some((l) => l.name === 'Rent')) broken.push('rent line for an owner')
  if (s.a.housing === 'own' && s.a.ownType === 'paid_off' && plan.lines.some((l) => l.name === 'Mortgage')) broken.push('mortgage line for a paid-off home')
  if (s.a.behind === true && Number(s.a.arrears) > 0 && !plan.lines.some((l) => l.name === 'Catch up overdue')) broken.push('overdue amount ignored')
  const selfEmployed = s.a.incomeType === 'freelance' || s.a.incomeType === 'business'
  if (selfEmployed && plan.free === 0 && s.a.taxSetAside === 'not_yet' && tax === 0 && plan.income > 0) broken.push('self-employed with no tax reserve')
  return { plan, facts, broken }
}

/** Small seeded generator so a failing path can be replayed. */
function rng(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** Amount answers as multiples of income (or absolute for income itself). */
const RATIO: Record<string, number[]> = {
  lowMonth: [0.4, 0.7, 0.95], rent: [0.12, 0.3, 0.55, 1.2], mortgagePayment: [0.2, 0.35, 0.6], propertyCosts: [0.02, 0.06], familyContributionAmount: [0.05, 0.2],
  schoolFees: [0.05, 0.18], childcare: [0.08, 0.2], supportAmount: [0.03, 0.12], householdHelpAmount: [0.05, 0.1], carPayment: [0.08, 0.22], fuelAndUpkeep: [0.04, 0.1],
  healthCost: [0.02, 0.08], chronicAmount: [0.02, 0.06], otherFixedBills: [0.03, 0.09], subsAmount: [0.01, 0.04],
  cardBalance: [0.5, 3, 9], cardMin: [0.03, 0.1], loanBalance: [2, 10, 30], loanMin: [0.05, 0.25, 0.6], bnplMonthly: [0.05, 0.2], familyOwed: [1, 4], familyMonthly: [0, 0.05],
  studentBalance: [5, 20], studentMin: [0, 0.05, 0.1], taxOwed: [1, 5], arrears: [0.1, 0.5], debtExtra: [0.02, 0.1],
  savingsOnHand: [0, 0.3, 1.5, 6], insurancePremium: [0.01, 0.04], retirementAmount: [0.05, 0.1], investMonthly: [0.03, 0.1], zakatAmount: [0.01, 0.03],
  goalTarget: [1, 6, 30], goalSaved: [0, 0.5], goalMonthly: [0.02, 0.1, 0.4], goalTargetNew: [0.5, 2], saveCustom: [0.05, 0.25], annualTotal: [0.3, 2],
  extraIncome: [0.05, 0.2], bigSoonAmount: [0.5, 4, 20], mortgageBalance: [10, 40], goal2Target: [1, 8],
}

function sample(x: FlowNode, s: FlowState, r: () => number): FlowValue {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]
  const inc = Number(s.a.income ?? s.known.income) || 10000
  switch (x.control) {
    case 'confirm':
      return r() > 0.2
    case 'toggle':
      return r() > 0.6
    case 'chips':
      return pick(x.opts ?? [])
    case 'multi': {
      const o = [...(x.opts ?? [])]
      const k = Math.floor(r() * Math.min(4, o.length + 1))
      const out: string[] = []
      for (let i = 0; i < k && o.length; i++) out.push(o.splice(Math.floor(r() * o.length), 1)[0])
      return x.id === 'priorities' ? out.slice(0, 3) : out
    }
    case 'stepper':
    case 'slider': {
      const lo = x.min ?? 0
      const hi = x.max ?? 100
      return Math.round(lo + r() * (hi - lo))
    }
    case 'amount': {
      if (x.id === 'income') return pick([4000, 9000, 16000, 40000])
      const ratios = RATIO[x.id] ?? [0.05, 0.2]
      const base = x.id === 'goalSaved' ? Number(s.a.goalTarget) || inc : inc
      return Math.round(pick(ratios) * base)
    }
  }
}

type Known = Record<string, FlowValue>
const PROFILES: Record<string, Known> = {
  blank: {},
  history: { income: 12000, hasHistory: true, knownBillCount: 3, knownSubCount: 2, savingsOnHand: 15000, housing: 'rent', rent: 3500, household: 'couple' },
  debtsKnown: { income: 9000, knownDebtCount: 2, knownDebtMinimum: 1500, knownDebtBalance: 40000, knownHighApr: true, knownBillCount: 2, knownSubCount: 1 },
  rich: { income: 20000, hasHistory: true, knownBillCount: 4, knownSubCount: 3, savingsOnHand: 80000, housing: 'rent', rent: 5000, rentConflict: true, household: 'couple', partnerRole: 'shares', partnerSharePct: 60, transportMode: 'public', foodFrequency: 'sometimes', lifestyle: 'balanced', healthCover: 'full', supportsOthers: false, emergencyMonths: 3, retirement: 'employer', annualKinds: [] },
  goalsKnown: { income: 15000, knownGoalCount: 2, knownBillCount: 4, knownSubCount: 3, hasHistory: true, savingsOnHand: 30000 },
}
const INTENTS: FlowIntent[] = ['save', 'goal', 'debt', 'mixed']
const MAX_STEPS = 60

interface Step { id: string; mod: string; a: FlowValue | 'skip' }
function walk(intent: FlowIntent, known: Known, r: () => number, script?: Record<string, FlowValue | 'skip'>) {
  let s = createFlow(intent, known)
  const steps: Step[] = []
  const problems: string[] = []
  for (let i = 0; i < MAX_STEPS; i++) {
    const q = nextQuestion(s)
    if (!q) break
    // Dependency check: a question must not read an answer that has not been collected, been skipped, or been known.
    if (q.when && q.needs === undefined) {
      const reads = new Set<string>()
      const watch = (o: Record<string, FlowValue>) => new Proxy(o, { get: (t, k) => (typeof k === 'string' && reads.add(k), t[k as string]) })
      q.when({ ...s, a: watch(s.a), known: watch(s.known) })
      for (const k of reads) {
        const dep = NODE_BY_ID.get(k)
        // A read of an answer that was never collected is fine when that question did not apply; it is a bug when it applied and was cut.
        if (dep && !['securityLean', 'investing'].includes(q.id) && !(k in s.a) && !s.skipped.includes(k) && s.known[k] === undefined && worthAsking(s, dep) && (dep.when ? dep.when(s) : true)) problems.push(`${q.id} reads ${k} which applied but was not asked`)
      }
    }
    // A screen holds the question and the related fields its answers unlock: fill them the way a person would, top to bottom.
    const values: Record<string, FlowValue> = {}
    const skips: string[] = []
    let nodes = screenNodes(s, q, values, skips)
    for (let guard = 0; guard < 10; guard++) {
      const open = nodes.find((x) => !(x.id in values) && !skips.includes(x.id))
      if (!open) break
      const forcedHere = script?.[open.id]
      if (forcedHere === 'skip' || (forcedHere === undefined && open.skippable && r() < 0.18)) skips.push(open.id)
      else values[open.id] = forcedHere ?? sample(open, s, r)
      nodes = screenNodes(s, q, values, skips)
    }
    for (const x of nodes) {
      if (steps.some((y) => y.id === x.id)) problems.push(`${x.id} asked twice`)
      if (skips.includes(x.id)) {
        s = skip(s, x.id)
        steps.push({ id: x.id, mod: x.mod, a: 'skip' })
      } else if (x.id in values) {
        s = answer(s, x.id, values[x.id])
        steps.push({ id: x.id, mod: x.mod, a: values[x.id] })
      }
    }
  }
  if (steps.length >= MAX_STEPS) problems.push('did not terminate')
  return { s, steps, problems }
}

/** Interrupt checks may break module contiguity; everything else must walk each module once, in the intent's order. */
function orderProblems(intent: FlowIntent, steps: Step[]): string[] {
  const out: string[] = []
  const order = MODULE_ORDER[intent]
  let last = -1
  const seen = new Set<string>()
  for (const st of steps) {
    if (NODES.find((x) => x.id === st.id)?.needs) continue
    const idx = order.indexOf(st.mod as never)
    if (idx < last) out.push(`${st.id} (${st.mod}) came after a later module`)
    if (idx !== last && seen.has(st.mod)) out.push(`module ${st.mod} re-entered at ${st.id}`)
    seen.add(st.mod)
    last = Math.max(last, idx)
  }
  return out
}

const SCENARIOS: Array<{ name: string; intent: FlowIntent; known: Known; script: Record<string, FlowValue | 'skip'> }> = [
  { name: 'Salaried renter, solo, no debt, wants to save more', intent: 'save', known: {}, script: { income: 15000, incomeType: 'salary', incomeStability: 'fixed', payFrequency: 'monthly', payday: 25, housing: 'rent', rent: 4500, rentFreq: 'monthly', rentIncludesUtilities: false, household: 'solo', hasDebts: false, saveTarget: 'p20', saveObstacle: ['dining', 'shopping'], savingsOnHand: 6000, priorities: ['safety', 'goals'] } },
  { name: 'Homeowner with a mortgage, couple sharing costs, two kids', intent: 'save', known: {}, script: { income: 32000, incomeType: 'salary', incomeStability: 'fixed', housing: 'own', ownType: 'mortgage', mortgagePayment: 9000, mortgageYears: 14, propertyCosts: 800, household: 'family', dependents: 2, youngestChild: 'school', schoolFees: 4500, partnerRole: 'shares', partnerSharePct: 60, hasDebts: false, saveTarget: 'p10', saveObstacle: ['bills'], savingsOnHand: 40000, priorities: ['family', 'safety'] } },
  { name: 'Homeowner, mortgage paid off (no rent question, no mortgage questions)', intent: 'mixed', known: {}, script: { income: 22000, incomeType: 'salary', incomeStability: 'fixed', housing: 'own', ownType: 'paid_off', propertyCosts: 600, household: 'couple', partnerRole: 'separate', hasDebts: false, savingsOnHand: 120000, priorities: ['invest'] } },
  { name: 'Freelancer, variable income, card debt, wants out of debt', intent: 'debt', known: {}, script: { income: 20000, incomeType: 'freelance', lowMonth: 11000, taxSetAside: 'not_yet', taxPct: 15, housing: 'rent', rent: 6000, rentFreq: 'monthly', rentIncludesUtilities: true, debtKinds: ['card', 'loan'], cardPayFull: false, cardBalance: 45000, cardMin: 2500, cardApr: 'over25', loanBalance: 80000, loanMin: 3000, loanApr: '15_25', behind: false, debtStrategy: 'avalanche', debtExtra: 2000, household: 'solo', savingsOnHand: 1000, priorities: ['debt', 'safety'] } },
  { name: 'Debts exceed what income can carry (hardship branch)', intent: 'debt', known: {}, script: { income: 8000, incomeType: 'salary', incomeStability: 'fixed', debtKinds: ['card', 'loan', 'family'], cardPayFull: false, cardBalance: 60000, cardMin: 3000, cardApr: 'over25', loanBalance: 90000, loanMin: 3500, loanApr: 'unknown', familyOwed: 15000, familyMonthly: 500, behind: true, arrears: 4000, housing: 'rent', rent: 2500, household: 'solo', savingsOnHand: 0 } },
  { name: 'Big goal: house down payment, comfortable salary', intent: 'goal', known: {}, script: { income: 30000, incomeType: 'salary', incomeStability: 'fixed', goalKind: 'house', houseScope: 'down_payment', goalTarget: 600000, goalSaved: 50000, goalTiming: 'by_date', goalMonths: 48, housing: 'rent', rent: 8000, household: 'couple', partnerRole: 'shares', partnerSharePct: 55, hasDebts: false, savingsOnHand: 70000 } },
  { name: 'Big goal that does not fit (adjust branch)', intent: 'goal', known: {}, script: { income: 10000, incomeType: 'salary', incomeStability: 'fixed', goalKind: 'car', goalTarget: 400000, goalSaved: 0, goalTiming: 'by_date', goalMonths: 12, housing: 'rent', rent: 3500, household: 'solo', hasDebts: false, savingsOnHand: 2000, goalAdjust: 'extend', goalMonthsNew: 48 } },
  { name: 'Goal first but no safety net and a high-interest card', intent: 'goal', known: {}, script: { income: 14000, incomeType: 'salary', incomeStability: 'fixed', goalKind: 'wedding', goalTarget: 90000, goalTiming: 'by_amount', goalMonthly: 3000, debtKinds: ['card'], hasDebts: true, cardPayFull: false, cardBalance: 25000, cardMin: 1500, cardApr: 'over25', behind: false, housing: 'family', familyContribution: true, familyContributionAmount: 2000, household: 'solo', savingsOnHand: 0 } },
  { name: 'Lives with family, student allowance, nothing else', intent: 'mixed', known: {}, script: { income: 3000, incomeType: 'allowance', payFrequency: 'monthly', housing: 'family', familyContribution: false, household: 'solo', hasDebts: false, savingsOnHand: 500, priorities: ['safety'] } },
  { name: 'Existing user with history: only the gaps are asked', intent: 'mixed', known: PROFILES.rich, script: {} },
  { name: 'Existing user with tracked debts: confirm, then one question', intent: 'debt', known: PROFILES.debtsKnown, script: { incomeType: 'salary', incomeStability: 'fixed' } },
]

describe('budget flow graph', () => {
  it('writes scenario walkthroughs', () => {
    const out = SCENARIOS.map((sc) => {
      const { s, steps, problems } = walk(sc.intent, sc.known, rng(7), sc.script)
      const o = outcome(s)
      const pf = planFor(s)
      const byBlock: Record<string, number> = {}
      for (const l of pf.plan.lines) byBlock[l.block] = (byBlock[l.block] ?? 0) + l.amount
      return { name: sc.name, intent: sc.intent, problems: [...problems, ...pf.broken], plan: { income: pf.plan.income, free: pf.plan.free, byBlock, risks: pf.plan.risks, lines: pf.plan.lines.map((l) => [l.name, l.amount, l.block]) }, screens: new Set(steps.map((x) => NODE_BY_ID.get(x.id)?.group)).size, outcome: o, steps: steps.map((x) => ({ id: x.id, q: NODE_BY_ID.get(x.id)!.q, variant: NODE_BY_ID.get(x.id)!.variant?.(s), mod: x.mod, a: x.a, screen: NODE_BY_ID.get(x.id)!.group })) }
    })
    if (REPORT) writeFileSync(REPORT.replace('.json', '-scenarios.json'), JSON.stringify(out, null, 1))
    for (const o of out) expect(o.problems, o.name).toEqual([])
  })


  it('every node has copy and sane options', () => {
    for (const x of NODES) {
      expect(x.q.length, x.id).toBeGreaterThan(8)
      expect(x.q.length, `${x.id} question too long`).toBeLessThanOrEqual(95)
      expect(x.why.length, x.id).toBeGreaterThan(8)
      if (x.control === 'chips' || x.control === 'multi') expect(x.opts?.length, x.id).toBeGreaterThan(1)
    }
    expect(new Set(NODES.map((x) => x.id)).size).toBe(NODES.length)
  })

  it('walks every intent and profile without dead ends, repeats or reads of unasked answers', () => {
    const N = Number(process.env.FLOW_N ?? 400)
    const asked = new Map<string, number>()
    const optSeen = new Map<string, Set<string>>()
    const trans = new Map<string, Set<string>>()
    const lengths: Record<string, number[]> = {}
    const arche: Record<string, number> = {}
    const flags: Record<string, number> = {}
    const problems = new Map<string, number>()
    const examples = new Map<string, unknown>()
    const noIncome: string[] = []
    let total = 0
    for (const intent of INTENTS) {
      for (const [pname, known] of Object.entries(PROFILES)) {
        const key = `${intent}/${pname}`
        lengths[key] = []
        const r = rng(intent.length * 97 + pname.length * 31)
        for (let i = 0; i < N; i++) {
          const { s, steps, problems: p } = walk(intent, known, r)
          total++
          lengths[key].push(new Set(steps.map((st) => NODE_BY_ID.get(st.id)?.group)).size)
          for (const x of [...p, ...orderProblems(intent, steps)]) problems.set(x, (problems.get(x) ?? 0) + 1)
          steps.forEach((st, j) => {
            asked.set(st.id, (asked.get(st.id) ?? 0) + 1)
            const ak = typeof st.a === 'object' ? 'multi' : String(st.a)
            if (NODE_BY_ID.get(st.id)?.opts) {
              const set = optSeen.get(st.id) ?? new Set()
              if (typeof st.a === 'string') set.add(st.a)
              optSeen.set(st.id, set)
            }
            if (['chips', 'toggle', 'confirm'].includes(NODE_BY_ID.get(st.id)?.control ?? '')) {
              const k = `${st.id}=${ak}`
              const t = trans.get(k) ?? new Set()
              t.add(steps[j + 1]?.id ?? 'BUILD')
              trans.set(k, t)
            }
          })
          if (planIncome(s) <= 0) noIncome.push(key)
          const planCheck = planFor(s)
          for (const b of planCheck.broken) {
            problems.set(`plan: ${b}`, (problems.get(`plan: ${b}`) ?? 0) + 1)
            if (!examples.has(b)) examples.set(b, { intent, known: pname, a: s.a, lines: planCheck.plan.lines.map((l) => [l.name, l.amount]), income: planCheck.plan.income })
          }
          const o = outcome(s)
          arche[o.primary] = (arche[o.primary] ?? 0) + 1
          o.flags.forEach((f) => (flags[f] = (flags[f] ?? 0) + 1))
        }
      }
    }
    const stats = Object.fromEntries(
      Object.entries(lengths).map(([k, v]) => {
        const sorted = [...v].sort((a, b) => a - b)
        return [k, { avg: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1), p50: sorted[Math.floor(v.length / 2)], p95: sorted[Math.floor(v.length * 0.95)], max: sorted.at(-1) }]
      }),
    )
    const never = NODES.filter((x) => !asked.has(x.id)).map((x) => x.id)
    const unseenOpts = NODES.filter((x) => x.opts && (x.control === 'chips') && asked.has(x.id))
      .flatMap((x) => x.opts!.filter((o) => !optSeen.get(x.id)?.has(o)).map((o) => `${x.id}=${o}`))
    if (REPORT) {
      writeFileSync(
        REPORT,
        JSON.stringify({ examples: Object.fromEntries(examples), total, nodes: NODES.length, never, unseenOpts, stats, arche, flags, problems: [...problems], noIncome: noIncome.length, asked: Object.fromEntries(asked), trans: Object.fromEntries([...trans].map(([k, v]) => [k, [...v]])) }, null, 1),
      )
    }
    expect([...problems.keys()]).toEqual([])
    expect(never).toEqual([])
    expect(unseenOpts).toEqual([])
    expect(noIncome).toEqual([])
    for (const v of Object.values(stats)) expect(v.max).toBeLessThanOrEqual(24)
  }, 900_000)
})
