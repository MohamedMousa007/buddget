import type { BudgetFacts, FactDebt, StudioPriority } from '@/lib/budget/facts'
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
}

const WEIGHT: Record<Tier, number> = { required: 3, important: 2, optional: 1 }
const HIGH_APR = 15

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

const hasDebts = (f: BudgetFacts) => f.debts.length > 0
const needsPayoffPlan = (f: BudgetFacts) =>
  f.debts.some((d) => d.apr !== null && d.apr >= HIGH_APR) ||
  (f.debts.length > 1 && f.debts.some((d) => d.balance > 0))
const drives = (f: BudgetFacts) => f.transportMode === 'car' || f.hasCar
const paysRent = (f: BudgetFacts) => f.housing === 'rent' || f.housing === 'own'

export const QUESTIONS: readonly Question[] = [
  q('confirmIncome', 'found', 'required', 'confirm', {
    askIf: (f, s) => f.monthlyIncome > 0 && !('income' in s.answers),
    prefill: (f) => positive(f.monthlyIncome),
    writes: { kind: 'none' },
  }),
  q('income', 'found', 'required', 'amount', {
    askIf: (f) => f.monthlyIncome <= 0,
    writes: { kind: 'facts', key: 'monthlyIncome' },
    toFacts: (v) => ({ monthlyIncome: v as number }),
    min: 0,
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
  q('missingBills', 'home', 'important', 'multi', {
    options: opts('missingBills', ['phone', 'internet', 'insurance', 'school', 'help', 'gym']),
    writes: { kind: 'facts', key: 'missingBills' },
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
  q('carCosts', 'life', 'important', 'multi', {
    options: opts('carCosts', ['fuel', 'insurance']),
    askIf: drives,
    writes: { kind: 'facts', key: 'carCosts' },
  }),

  q('payoffStrategy', 'debts', 'important', 'chips', {
    options: opts('payoffStrategy', ['avalanche', 'snowball', 'minimums']),
    askIf: needsPayoffPlan,
    writes: { kind: 'financial', key: 'payoffStrategy' },
    toFacts: (v) => ({ payoffStrategy: v as BudgetFacts['payoffStrategy'] }),
  }),
  q('extraPayoff', 'debts', 'optional', 'stepper', {
    askIf: needsPayoffPlan,
    min: 0,
    step: 50,
    writes: { kind: 'facts', key: 'extraPayoff' },
    toFacts: (v) => ({ extraPayoff: v as number }),
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
  q('zakat', 'secure', 'optional', 'toggle', {
    askIf: (f) => f.zakatMonthly === 0,
    writes: { kind: 'facts', key: 'zakat' },
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
const DEBT_APR_PREFIX = 'debtApr:'

function debtAprQuestion(d: FactDebt): Question {
  return {
    id: `${DEBT_APR_PREFIX}${d.id}`,
    stage: 'debts',
    tier: 'important',
    control: 'amount',
    labelKey: key('debtApr'),
    whyKey: `${key('debtApr')}.why`,
    min: 0,
    max: 100,
    askIf: always,
    prefill: () => null,
    writes: { kind: 'facts', key: `${DEBT_APR_PREFIX}${d.id}` },
  }
}

export function questionById(id: string): Question | undefined {
  return BY_ID.get(id)
}

function tierOf(id: string): Tier {
  return id.startsWith(DEBT_APR_PREFIX) ? 'important' : (questionById(id)?.tier ?? 'optional')
}

/** The static graph plus one APR question per debt whose rate is unknown, right after "confirm debts". */
function questionsFor(f: BudgetFacts): Question[] {
  const aprs = f.debts.filter((d) => d.apr === null).map(debtAprQuestion)
  return QUESTIONS.flatMap((x) => (x.id === 'confirmDebts' ? [x, ...aprs] : [x]))
}

export function createState(): StudioState {
  return { v: 2, stage: 'found', answers: {}, skipped: [] }
}

export function mergeFacts(base: BudgetFacts, s: StudioState): BudgetFacts {
  let merged = base
  for (const [id, value] of Object.entries(s.answers)) {
    if (id.startsWith(DEBT_APR_PREFIX)) {
      const debtId = id.slice(DEBT_APR_PREFIX.length)
      merged = {
        ...merged,
        debts: merged.debts.map((d) => (d.id === debtId ? { ...d, apr: value as number } : d)),
      }
      continue
    }
    const patch = questionById(id)?.toFacts?.(value, merged)
    if (patch) merged = { ...merged, ...patch }
  }
  return merged
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
  return questionsFor(f)
    .filter((x) => x.askIf(merged, s))
    .map((x) => ({
      question: x,
      answered: isAnswered(s, x.id),
      skipped: s.skipped.includes(x.id),
      known: isKnown(x, merged),
    }))
}

export function visibleQuestions(f: BudgetFacts, s: StudioState): Question[] {
  return evaluate(f, s)
    .filter((e) => !e.answered && !e.skipped && (e.question.control === 'confirm' || !e.known))
    .map((e) => e.question)
    .sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage))
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
}

export function readiness(f: BudgetFacts, s: StudioState): Readiness {
  const items = evaluate(f, s)
  const total = items.reduce((sum, e) => sum + WEIGHT[e.question.tier], 0)
  const done = items
    .filter((e) => e.answered || e.skipped || e.known)
    .reduce((sum, e) => sum + WEIGHT[e.question.tier], 0)
  const missingRequired = items
    .filter((e) => e.question.tier === 'required' && !e.answered && !e.known)
    .map((e) => e.question.id)
  return {
    percent: total === 0 ? 100 : Math.round((done / total) * 100),
    missingRequired,
    estimated: items.filter((e) => e.skipped && e.question.tier === 'important').map((e) => e.question.id),
    canBuild: missingRequired.length === 0,
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
