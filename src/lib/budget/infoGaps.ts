import type { BudgetFacts, FactDebt, FactGoal, StudioPriority } from '@/lib/budget/facts'
import type { FinancialProfile, UserProfile } from '@/lib/store/types'

export type Tier = 'required' | 'important' | 'optional'
export type StudioStage = 'found' | 'home' | 'life' | 'debts' | 'secure' | 'priorities'
export type Control = 'confirm' | 'chips' | 'single' | 'stepper' | 'amount' | 'toggle' | 'slider' | 'rank' | 'multi'

export const STAGES: readonly StudioStage[] = ['found', 'home', 'life', 'debts', 'secure', 'priorities']

/**
 * Where an answer persists. `profile` / `financial` write through immediately in the UI
 * (`map` reshapes the raw answer into the stored value). `facts` answers only feed the engine
 * via `mergeFacts` / the raw answers; `none` is a pure acknowledgement.
 */
export type AnswerWrite =
  | { kind: 'profile'; key: keyof UserProfile; map?: (value: unknown) => unknown }
  | { kind: 'financial'; key: keyof FinancialProfile }
  | { kind: 'facts'; key: keyof BudgetFacts | string }
  | { kind: 'none' }

export interface Question {
  id: string
  /** Share of the plan this answer can move (0 to 1). Ranks the queue and weights readiness. */
  stake: number
  /** The question whose "yes" unlocks this one; unlocked follow-ups are never cut by the question cap. */
  follows?: string
  stage: StudioStage
  tier: Tier
  control: Control
  labelKey: string
  whyKey: string
  options?: { value: string; labelKey: string }[]
  min?: number
  max?: number
  step?: number
  /** Receives facts already overridden by the studio answers (see `mergeFacts`). */
  askIf: (f: BudgetFacts, s: StudioState) => boolean
  /** The value the app already knows; null/undefined means unknown. */
  prefill: (f: BudgetFacts) => unknown
  /** Control default shown when nothing is known (not a known value). */
  suggest?: (f: BudgetFacts) => unknown
  writes: AnswerWrite
  /** Projects the answer onto the facts the engine reads. */
  toFacts?: (value: unknown, f: BudgetFacts) => Partial<BudgetFacts>
}

export interface StudioState {
  v: 2
  stage: StudioStage
  answers: Record<string, unknown>
  skipped: string[]
  /** Records the studio already created from the answers, so a retried build never creates them twice. */
  entities?: Record<string, string>
  /** The optional describe-yourself step has been answered or skipped. */
  opener?: 'done'
}

/** Most non-confirm questions one run asks; required questions and unlocked follow-ups are exempt from the cut. */
const MAX_ASKED = 9
/** Skipped questions are estimated, so they still leave half their stake uncertain. */
const SKIPPED_UNCERTAINTY = 0.5
/** Readiness at which the plan is good enough to build without the remaining questions. */
const ENOUGH_PERCENT = 85
/** A ledger rent this far from the stated rent is worth one question. */
const RENT_CONFLICT = 0.2

/** Ids of facts the studio builds from answers; they stand in for a debt or goal the user has not created yet. */
export const ANSWERED_DEBT_ID = 'answered-debt'
export const ANSWERED_GOAL_ID = 'answered-goal'
const DEFAULT_GOAL_MONTHS = 12
const DEFAULT_PAYDAY = 25

const STAKE: Record<string, number> = {
  income: 1, housing: 0.8, rent: 0.7, household: 0.5, rentIncludesUtilities: 0.2, dependents: 0.35, supportsOthers: 0.25,
  incomeStability: 0.5, lowMonth: 0.35, rentCheck: 0.4, foodFrequency: 0.25, lifestyle: 0.35, transportMode: 0.3, cashHeavy: 0.3,
  hasDebts: 0.5, debtTotal: 0.3, debtMonthly: 0.5, savingsOnHand: 0.4, emergencyMonths: 0.2, hasGoal: 0.3, goalTarget: 0.25,
  goalMonths: 0.15, goalKind: 0.1, payday: 0.2, investInterest: 0.1, priorities: 0.3, securityLean: 0.25,
}

const always = () => true
const unknown = () => null
const key = (id: string) => `budget.studio.q.${id}`

function opts(id: string, values: string[]) {
  return values.map((value) => ({ value, labelKey: `${key(id)}.opt.${value}` }))
}

function q(
  id: string,
  stage: StudioStage,
  tier: Tier,
  control: Control,
  rest: Partial<Question> & Pick<Question, 'writes'>,
): Question {
  return {
    id,
    stake: STAKE[id] ?? 0.1,
    stage,
    tier,
    control,
    labelKey: key(id),
    whyKey: `${key(id)}.why`,
    askIf: always,
    prefill: unknown,
    ...rest,
  }
}

const known = <T>(v: T | null | undefined) => (v === null || v === undefined ? null : v)
const positive = (n: number | null | undefined) => (n !== null && n !== undefined && n > 0 ? n : null)

const realDebts = (f: BudgetFacts) => f.debts.filter((d) => d.id !== ANSWERED_DEBT_ID)
const realGoals = (f: BudgetFacts) => f.goals.filter((g) => g.id !== ANSWERED_GOAL_ID)
const hasDebts = (f: BudgetFacts) => realDebts(f).length > 0
const yes = (s: StudioState, id: string) => s.answers[id] === true
const rentConflicts = (f: BudgetFacts) =>
  paysRent(f) && (f.rent ?? 0) > 0 && f.ledgerRent !== undefined && Math.abs(f.ledgerRent - (f.rent ?? 0)) / (f.rent ?? 1) > RENT_CONFLICT
const paysRent = (f: BudgetFacts) => f.housing === 'rent' || f.housing === 'own'

export const QUESTIONS: readonly Question[] = [
  q('confirmIncome', 'found', 'required', 'confirm', {
    askIf: (f, s) => f.monthlyIncome > 0 && !('income' in s.answers),
    prefill: (f) => positive(f.monthlyIncome),
    writes: { kind: 'none' },
  }),
  q('income', 'found', 'important', 'amount', {
    askIf: (f, s) => 'income' in s.answers || f.monthlyIncome <= 0,
    writes: { kind: 'facts', key: 'monthlyIncome' },
    toFacts: (v) => ({ monthlyIncome: v as number }),
    min: 0,
  }),
  q('payday', 'found', 'important', 'stepper', {
    follows: 'income',
    askIf: (_f, s) => Number(s.answers.income) > 0,
    suggest: () => DEFAULT_PAYDAY,
    min: 1,
    max: 31,
    step: 1,
    writes: { kind: 'facts', key: 'payday' },
  }),
  q('confirmBills', 'found', 'required', 'confirm', {
    askIf: (f) => f.bills.length + f.subscriptionCount > 0,
    prefill: (f) => (f.bills.length + f.subscriptionCount > 0 ? true : null),
    writes: { kind: 'none' },
  }),
  q('confirmDebts', 'found', 'required', 'confirm', {
    askIf: hasDebts,
    prefill: (f) => (hasDebts(f) ? true : null),
    writes: { kind: 'none' },
  }),
  q('confirmGoals', 'found', 'important', 'confirm', {
    askIf: (f) => f.goals.length > 0,
    prefill: (f) => (f.goals.length > 0 ? true : null),
    writes: { kind: 'none' },
  }),

  q('housing', 'home', 'required', 'chips', {
    options: opts('housing', ['rent', 'own', 'family', 'company']),
    prefill: (f) => known(f.housing),
    writes: { kind: 'financial', key: 'housing' },
    toFacts: (v) => ({ housing: v as BudgetFacts['housing'] }),
  }),
  q('rent', 'home', 'required', 'amount', {
    askIf: paysRent,
    prefill: (f) => positive(f.rent),
    writes: { kind: 'profile', key: 'monthlyRent' },
    toFacts: (v) => ({ rent: v as number }),
    min: 0,
  }),
  q('rentCheck', 'home', 'important', 'chips', {
    options: opts('rentCheck', ['stated', 'records']),
    askIf: (f, s) => 'rentCheck' in s.answers || rentConflicts(f),
    writes: { kind: 'facts', key: 'rentCheck' },
    toFacts: (v, f) => (v === 'records' && f.ledgerRent !== undefined ? { rent: Math.round(f.ledgerRent) } : {}),
  }),
  q('rentIncludesUtilities', 'home', 'required', 'toggle', {
    askIf: (f) => paysRent(f) && (f.rent ?? 0) > 0,
    prefill: (f) => (f.known?.has('rentIncludesUtilities') ? f.rentIncludesUtilities : null),
    writes: { kind: 'profile', key: 'rentIncludesUtilities' },
    toFacts: (v) => ({ rentIncludesUtilities: v as boolean }),
  }),
  q('household', 'home', 'required', 'chips', {
    options: opts('household', ['solo', 'couple', 'family']),
    prefill: (f) => (f.known?.has('household') || f.household !== 'solo' || f.dependents > 0 ? f.household : null),
    writes: { kind: 'profile', key: 'household' },
    toFacts: (v) => ({ household: v as BudgetFacts['household'] }),
  }),
  q('dependents', 'home', 'important', 'stepper', {
    askIf: (f) => f.household === 'family',
    prefill: (f) => positive(f.dependents),
    suggest: () => 1,
    min: 0,
    max: 10,
    step: 1,
    writes: { kind: 'financial', key: 'dependents' },
    toFacts: (v) => ({ dependents: v as number }),
  }),
  q('supportsOthers', 'home', 'important', 'toggle', {
    prefill: (f) => (f.supportsOthers || f.known?.has('supportsOthers') ? f.supportsOthers : null),
    writes: { kind: 'financial', key: 'supportsOthers' },
    toFacts: (v) => ({ supportsOthers: v as boolean }),
  }),
  q('incomeStability', 'home', 'important', 'chips', {
    options: opts('incomeStability', ['fixed', 'variable', 'mixed']),
    prefill: (f) => (f.incomeFloor !== null || f.known?.has('incomeStability') ? f.incomeStability : null),
    writes: { kind: 'financial', key: 'incomeStability' },
    toFacts: (v) => ({ incomeStability: v as BudgetFacts['incomeStability'] }),
  }),

  q('lowMonth', 'home', 'important', 'amount', {
    askIf: (f, s) => 'lowMonth' in s.answers || (f.monthlyIncome > 0 && f.incomeStability !== 'fixed' && f.incomeFloor === null),
    writes: { kind: 'facts', key: 'incomeFloor' },
    toFacts: (v) => ({ incomeFloor: v as number }),
    min: 0,
  }),

  q('foodFrequency', 'life', 'important', 'chips', {
    options: opts('foodFrequency', ['everyday', 'mostdays', 'sometimes', 'rarely']),
    prefill: (f) => known(f.foodFrequency),
    writes: { kind: 'profile', key: 'foodFrequency' },
    toFacts: (v) => ({ foodFrequency: v as BudgetFacts['foodFrequency'] }),
  }),
  q('lifestyle', 'life', 'important', 'chips', {
    options: opts('lifestyle', ['minimal', 'balanced', 'comfortable']),
    prefill: (f) => (f.known?.has('lifestyle') ? f.lifestyle : null),
    writes: { kind: 'profile', key: 'lifestyleTier' },
    toFacts: (v) => ({ lifestyle: v as BudgetFacts['lifestyle'] }),
  }),
  q('transportMode', 'life', 'important', 'chips', {
    options: opts('transportMode', ['public', 'car', 'taxi', 'walk']),
    prefill: (f) => known(f.transportMode),
    writes: { kind: 'profile', key: 'transportMode' },
    toFacts: (v) => ({ transportMode: v as BudgetFacts['transportMode'], hasCar: v === 'car' }),
  }),

  q('cashHeavy', 'life', 'optional', 'toggle', {
    askIf: (f, s) => 'cashHeavy' in s.answers || Object.keys(f.averages).length > 0,
    prefill: (f) => (f.cashHeavy === undefined ? null : f.cashHeavy),
    writes: { kind: 'financial', key: 'cashHeavy' },
    toFacts: (v) => ({ cashHeavy: v as boolean }),
  }),

  q('hasDebts', 'debts', 'important', 'toggle', {
    askIf: (f, s) => 'hasDebts' in s.answers || !hasDebts(f),
    writes: { kind: 'facts', key: 'hasDebts' },
  }),
  q('debtTotal', 'debts', 'important', 'amount', {
    follows: 'hasDebts',
    askIf: (_f, s) => yes(s, 'hasDebts'),
    writes: { kind: 'facts', key: 'debtTotal' },
    min: 0,
  }),
  q('debtMonthly', 'debts', 'important', 'amount', {
    follows: 'hasDebts',
    askIf: (_f, s) => yes(s, 'hasDebts'),
    writes: { kind: 'facts', key: 'debtMonthly' },
    min: 0,
  }),

  q('savingsOnHand', 'secure', 'important', 'amount', {
    askIf: (f, s) => 'savingsOnHand' in s.answers || f.liquidSavings === 0,
    writes: { kind: 'facts', key: 'liquidSavings' },
    toFacts: (v) => ({ liquidSavings: v as number }),
    min: 0,
  }),
  q('emergencyMonths', 'secure', 'important', 'stepper', {
    suggest: (f) =>
      f.incomeStability === 'variable' || f.dependents >= 1 ? 6 : f.emergencyTargetMonths,
    min: 1,
    max: 12,
    step: 1,
    writes: { kind: 'profile', key: 'emergencyFundConfig', map: (v) => ({ targetMonths: v }) },
    toFacts: (v) => ({ emergencyTargetMonths: v as number }),
  }),
  q('investInterest', 'secure', 'optional', 'toggle', {
    prefill: (f) => (f.investInterest ? true : null),
    writes: { kind: 'financial', key: 'investInterest' },
    toFacts: (v) => ({ investInterest: v as boolean }),
  }),

  q('hasGoal', 'secure', 'optional', 'toggle', {
    askIf: (f, s) => 'hasGoal' in s.answers || realGoals(f).length === 0,
    writes: { kind: 'facts', key: 'hasGoal' },
  }),
  q('goalKind', 'secure', 'optional', 'chips', {
    follows: 'hasGoal',
    options: opts('goalKind', ['vacation', 'house', 'car', 'education', 'wedding', 'custom']),
    askIf: (_f, s) => yes(s, 'hasGoal'),
    writes: { kind: 'facts', key: 'goalKind' },
  }),
  q('goalTarget', 'secure', 'optional', 'amount', {
    follows: 'hasGoal',
    askIf: (_f, s) => yes(s, 'hasGoal'),
    writes: { kind: 'facts', key: 'goalTarget' },
    min: 0,
  }),
  q('goalMonths', 'secure', 'optional', 'stepper', {
    follows: 'hasGoal',
    askIf: (_f, s) => yes(s, 'hasGoal'),
    suggest: () => DEFAULT_GOAL_MONTHS,
    min: 1,
    max: 60,
    step: 1,
    writes: { kind: 'facts', key: 'goalMonths' },
  }),

  q('priorities', 'priorities', 'important', 'multi', {
    options: opts('priorities', ['safety', 'debt', 'goals', 'invest', 'enjoy', 'family']),
    max: 3,
    prefill: (f) => (f.priorities.length > 0 ? f.priorities : null),
    writes: { kind: 'financial', key: 'priorities' },
    toFacts: (v) => ({ priorities: v as StudioPriority[] }),
  }),
  q('securityLean', 'priorities', 'important', 'slider', {
    min: 0,
    max: 100,
    step: 5,
    suggest: (f) => (f.priorities.includes('safety') || f.priorities.includes('debt') ? 35 : 50),
    writes: { kind: 'financial', key: 'securityLean' },
    toFacts: (v) => ({ securityLean: v as number }),
  }),
]

const BY_ID = new Map(QUESTIONS.map((x) => [x.id, x]))

export function questionById(id: string): Question | undefined {
  return BY_ID.get(id)
}

function tierOf(id: string): Tier {
  return questionById(id)?.tier ?? 'optional'
}

export function createState(): StudioState {
  return { v: 2, stage: 'found', answers: {}, skipped: [] }
}

/** The debt and goal the user described in the studio, as facts the engine can plan with. */
function withAnsweredEntities(f: BudgetFacts, s: StudioState): BudgetFacts {
  let out = f
  if (yes(s, 'hasDebts') && !s.entities?.debt) {
    const balance = Number(s.answers.debtTotal) || 0
    const minimum = Number(s.answers.debtMonthly) || 0
    if (balance > 0 || minimum > 0) {
      const debt: FactDebt = { id: ANSWERED_DEBT_ID, name: 'Debts', minimum, balance, kind: 'personal' }
      out = { ...out, debts: [...out.debts, debt] }
    }
  }
  if (yes(s, 'hasGoal') && !s.entities?.goal) {
    const target = Number(s.answers.goalTarget) || 0
    if (target > 0) {
      const months = Math.max(1, Number(s.answers.goalMonths) || DEFAULT_GOAL_MONTHS)
      const goal: FactGoal = {
        id: ANSWERED_GOAL_ID, name: 'Savings goal', monthly: Math.ceil(target / months), targetAmount: target,
        saved: 0, targetDate: null, priority: 1, icon: 'target',
      }
      out = { ...out, goals: [...out.goals, goal] }
    }
  }
  return out
}

export function mergeFacts(base: BudgetFacts, s: StudioState): BudgetFacts {
  let merged = base
  for (const [id, value] of Object.entries(s.answers)) {
    const patch = questionById(id)?.toFacts?.(value, merged)
    if (patch) merged = { ...merged, ...patch }
  }
  return withAnsweredEntities(merged, s)
}

const isAnswered = (s: StudioState, id: string) => id in s.answers
const isKnown = (x: Question, f: BudgetFacts) => x.prefill(f) != null

interface Evaluated {
  question: Question
  answered: boolean
  skipped: boolean
  known: boolean
}

function evaluate(f: BudgetFacts, s: StudioState): Evaluated[] {
  const merged = mergeFacts(f, s)
  return QUESTIONS
    .filter((x) => x.askIf(merged, s))
    .map((x) => ({
      question: x,
      answered: isAnswered(s, x.id),
      skipped: s.skipped.includes(x.id),
      known: isKnown(x, merged),
    }))
}

const isForced = (x: Question) => x.tier === 'required' || x.follows !== undefined

/**
 * What is still worth asking, in stage order. Confirm cards always show. Of the rest, required questions and unlocked
 * follow-ups always stay; other questions are taken by stake until the run has asked MAX_ASKED, so a blank profile gets
 * a short run and a profile the app already knows gets only the gaps.
 */
export function visibleQuestions(f: BudgetFacts, s: StudioState): Question[] {
  const items = evaluate(f, s)
  const pending = items.filter((e) => !e.answered && !e.skipped && (e.question.control === 'confirm' || !e.known))
  const asked = items.filter((e) => (e.answered || e.skipped) && e.question.control !== 'confirm').length
  const forced = pending.filter((e) => e.question.control !== 'confirm' && isForced(e.question)).length
  const room = Math.max(0, MAX_ASKED - asked - forced)
  const ranked = pending
    .filter((e) => e.question.control !== 'confirm' && !isForced(e.question))
    .sort((a, b) => b.question.stake - a.question.stake || QUESTIONS.indexOf(a.question) - QUESTIONS.indexOf(b.question))
  const allowed = new Set(ranked.slice(0, room).map((e) => e.question.id))
  return pending
    .filter((e) => e.question.control === 'confirm' || isForced(e.question) || allowed.has(e.question.id))
    .map((e) => e.question)
    .sort(
      (a, b) =>
        STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) ||
        Number(b.control === 'confirm') - Number(a.control === 'confirm') ||
        b.stake - a.stake ||
        QUESTIONS.indexOf(a) - QUESTIONS.indexOf(b)
    )
}

export function currentStage(f: BudgetFacts, s: StudioState): StudioStage {
  return visibleQuestions(f, s)[0]?.stage ?? 'priorities'
}

export function defaultValue(x: Question, f: BudgetFacts, s: StudioState): unknown {
  if (isAnswered(s, x.id)) return s.answers[x.id]
  const merged = mergeFacts(f, s)
  return x.prefill(merged) ?? x.suggest?.(merged)
}

export function applyAnswer(s: StudioState, id: string, value: unknown): StudioState {
  return {
    ...s,
    answers: { ...s.answers, [id]: value },
    skipped: s.skipped.filter((x) => x !== id),
  }
}

export function skipQuestion(s: StudioState, id: string): StudioState {
  if (tierOf(id) === 'required' || s.skipped.includes(id)) return s
  return { ...s, skipped: [...s.skipped, id] }
}

export interface Readiness {
  percent: number
  missingRequired: string[]
  estimated: string[]
  canBuild: boolean
  /** True once the plan is accurate enough to build now; the remaining questions only sharpen it. */
  enough: boolean
}

const uncertainty = (e: Evaluated): number => (e.answered || e.known ? 0 : e.skipped ? SKIPPED_UNCERTAINTY : 1)

/** Where a question's value comes from: the user, the app's own data, an estimate, or nothing yet. */
export type AnswerSource = 'user' | 'data' | 'estimate' | 'unknown'

export function answerSource(f: BudgetFacts, s: StudioState, id: string): AnswerSource {
  const e = evaluate(f, s).find((x) => x.question.id === id)
  if (!e) return 'unknown'
  return e.answered ? 'user' : e.known ? 'data' : e.skipped ? 'estimate' : 'unknown'
}

export function readiness(f: BudgetFacts, s: StudioState): Readiness {
  const queued = new Set(visibleQuestions(f, s).map((x) => x.id))
  // Questions the cap left out will not be asked, so they cannot hold readiness back.
  const items = evaluate(f, s).filter((e) => e.answered || e.skipped || e.known || queued.has(e.question.id))
  const total = items.reduce((sum, e) => sum + e.question.stake, 0)
  const residual = items.reduce((sum, e) => sum + e.question.stake * uncertainty(e), 0)
  const missingRequired = items
    .filter((e) => e.question.tier === 'required' && !e.answered && !e.known)
    .map((e) => e.question.id)
  const percent = total === 0 ? 100 : Math.round((1 - residual / total) * 100)
  const canBuild = missingRequired.length === 0
  return {
    percent,
    missingRequired,
    estimated: items.filter((e) => e.skipped && e.question.tier === 'important').map((e) => e.question.id),
    canBuild,
    enough: canBuild && percent >= ENOUGH_PERCENT,
  }
}

export function answersToProfilePatch(s: StudioState): {
  profile: Partial<UserProfile>
  financial: FinancialProfile
} {
  const profile: Record<string, unknown> = {}
  const financial: Record<string, unknown> = {}
  for (const [id, value] of Object.entries(s.answers)) {
    const w = questionById(id)?.writes
    if (w?.kind === 'profile') profile[w.key] = w.map ? w.map(value) : value
    else if (w?.kind === 'financial') financial[w.key] = value
  }
  return { profile: profile as Partial<UserProfile>, financial: financial as FinancialProfile }
}
