import type { BudgetFacts, EverydayKey, FactDebt, FactGoal } from '@/lib/budget/facts'
import type { FlowValue } from './types'

type Answers = Record<string, FlowValue>

const APR: Record<string, number | null> = { under15: 10, '15_25': 20, over25: 30, unknown: null }
const FREQ_DIV: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 }
const CUT_MAP: Partial<Record<string, EverydayKey>> = { dining: 'dining', fun: 'fun', shopping: 'shopping', transport: 'transport', groceries: 'groceries' }
/** Typical share held back when a self-employed person has not yet set anything aside and does not know the rate. */
const DEFAULT_TAX_RESERVE = 0.15
const SAVE_PCT: Record<string, number> = { p10: 0.1, p20: 0.2, p30: 0.3 }
const ZAKAT_RATE = 0.025

const num = (a: Answers, k: string): number | undefined => (typeof a[k] === 'number' ? (a[k] as number) : undefined)
const str = (a: Answers, k: string): string | undefined => (typeof a[k] === 'string' ? (a[k] as string) : undefined)
const list = (a: Answers, k: string): string[] => (Array.isArray(a[k]) ? (a[k] as string[]) : [])
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Monthly amount a goal needs, from either a date or a monthly figure. */
function goalMonthly(target: number, saved: number, months: number | undefined, monthly: number | undefined): number {
  if (monthly !== undefined) return Math.round(monthly)
  return Math.max(0, Math.ceil((target - saved) / Math.max(1, months ?? 12)))
}

/** Answers that describe a person's situation rather than a moment, so they can be remembered and reused on the next build. */
const STABLE_ANSWERS: readonly string[] = [
  'incomeType', 'incomeStability', 'jobSecurity', 'taxSetAside', 'taxPct', 'housing', 'ownType', 'rentFreq', 'rentIncludesUtilities', 'household', 'dependents',
  'youngestChild', 'schoolFees', 'childcare', 'partnerRole', 'partnerSharePct', 'supportsOthers', 'supportAmount', 'transportMode', 'carOwnership',
  'healthCover', 'healthCost', 'lifeInsurance', 'insurancePremium', 'retirement', 'retirementAmount', 'annualKinds', 'annualTotal', 'zakatMode', 'zakatAmount',
  'lifestyle', 'foodFrequency', 'priorities', 'securityLean', 'cutFirst', 'debtStrategy', 'saveTarget', 'saveCustom', 'cashHeavy',
]

/** The part of a run worth remembering: stable answers only, never balances or amounts that go stale. */
export function stableSnapshot(a: Answers): Answers {
  const out: Answers = {}
  for (const k of STABLE_ANSWERS) if (a[k] !== undefined) out[k] = a[k]
  return out
}

/** Lays the answers over the facts the app already holds. Absent answers leave the facts alone, so partial runs and remembered snapshots both work. */
export function applyAnswers(base: BudgetFacts, a: Answers, intent?: 'save' | 'goal' | 'debt' | 'mixed'): BudgetFacts {
  const f: BudgetFacts = { ...base }
  const income = num(a, 'income') ?? base.monthlyIncome
  if (num(a, 'income') !== undefined) f.monthlyIncome = income

  const type = str(a, 'incomeType') as BudgetFacts['incomeType'] | undefined
  if (type) {
    f.incomeType = type
    f.incomeStability = type === 'freelance' || type === 'business' || type === 'seasonal' ? 'variable' : type === 'mixed' ? 'mixed' : type === 'salary' ? ((str(a, 'incomeStability') as BudgetFacts['incomeStability']) ?? 'fixed') : 'fixed'
  } else if (str(a, 'incomeStability')) f.incomeStability = str(a, 'incomeStability') as BudgetFacts['incomeStability']
  if (str(a, 'jobSecurity')) f.jobUncertain = str(a, 'jobSecurity') !== 'secure'
  if (num(a, 'lowMonth') !== undefined) f.incomeFloor = num(a, 'lowMonth') ?? null
  if (f.incomeType === 'freelance' || f.incomeType === 'business' || f.incomeType === 'mixed' || f.incomeType === 'seasonal') {
    const t = str(a, 'taxSetAside')
    if (t === 'not_yet') f.taxReservePct = (num(a, 'taxPct') ?? DEFAULT_TAX_RESERVE * 100) / 100
    else if (t === 'already' || t === 'not_needed') f.taxReservePct = 0
    else if (f.incomeType === 'freelance' || f.incomeType === 'business') f.taxReservePct = DEFAULT_TAX_RESERVE
  }

  // Housing: owning never produces a rent; a mortgage is the housing cost, a paid-off home only has upkeep.
  const share = str(a, 'partnerRole') === 'shares' ? clamp((num(a, 'partnerSharePct') ?? 50) / 100, 0.1, 1) : 1
  const housing = str(a, 'housing') as BudgetFacts['housing'] | undefined
  if (housing) {
    f.housing = housing
    if (housing === 'rent') {
      const stated = num(a, 'rent') !== undefined ? (num(a, 'rent') as number) / (FREQ_DIV[str(a, 'rentFreq') ?? 'monthly'] ?? 1) : base.rent
      f.rent = stated != null ? Math.round(stated * share) : null
    }
    else if (housing === 'own') f.rent = str(a, 'ownType') === 'mortgage' && num(a, 'mortgagePayment') !== undefined ? Math.round((num(a, 'mortgagePayment') as number) * share) : null
    else f.rent = null
  } else if (share !== 1 && base.housing === 'rent' && base.rent != null) f.rent = Math.round(base.rent * share)
  if (num(a, 'propertyCosts') !== undefined) f.propertyMonthly = Math.round((num(a, 'propertyCosts') as number) * share)
  if (typeof a.rentIncludesUtilities === 'boolean') f.rentIncludesUtilities = a.rentIncludesUtilities
  // Records and the typed figure disagreed and the person chose the records.
  if (str(a, 'rentCheck') === 'records' && base.ledgerRent !== undefined && f.housing === 'rent') f.rent = Math.round(base.ledgerRent * share)

  const extras = [...(base.extraCommitments ?? [])]
  const addCommitment = (name: string, amount: number | undefined) => {
    if (amount && amount > 0 && !extras.some((e) => e.name === name)) extras.push({ name, amount: Math.round(amount) })
  }
  if (a.familyContribution === true) addCommitment('Household contribution', num(a, 'familyContributionAmount'))
  if (a.supportsOthers === true) addCommitment('Family support', num(a, 'supportAmount'))
  // Costs described in words, stored as "name|amount".
  for (const c of list(a, 'commitments')) {
    const [name, amount] = c.split('|')
    addCommitment(name, Number(amount))
  }
  if (extras.length > 0) f.extraCommitments = extras

  const household = str(a, 'household') as BudgetFacts['household'] | undefined
  if (household) f.household = household
  if (num(a, 'dependents') !== undefined) f.dependents = num(a, 'dependents') as number
  if (typeof a.supportsOthers === 'boolean') f.supportsOthers = a.supportsOthers
  const child = str(a, 'youngestChild')
  if (num(a, 'schoolFees') !== undefined && (child === 'school' || child === 'teen')) f.schoolMonthly = Math.round((num(a, 'schoolFees') as number) * share)
  if (num(a, 'childcare') !== undefined && child === 'under5') f.childcareMonthly = Math.round((num(a, 'childcare') as number) * share)

  const cover = str(a, 'healthCover')
  if (cover) f.healthMonthly = cover === 'full' ? 0 : (num(a, 'healthCost') ?? 0) + (a.chronicMeds === true ? (num(a, 'chronicAmount') ?? 0) : 0)
  if (a.lifeInsurance === true && num(a, 'insurancePremium') !== undefined) f.insuranceMonthly = num(a, 'insurancePremium')

  const tm = str(a, 'transportMode') as BudgetFacts['transportMode'] | undefined
  if (tm) {
    f.transportMode = tm
    f.hasCar = tm === 'car'
  }
  for (const k of ['lifestyle', 'foodFrequency'] as const) if (str(a, k)) (f as unknown as Record<string, unknown>)[k] = str(a, k)
  if (typeof a.cashHeavy === 'boolean') f.cashHeavy = a.cashHeavy

  const ret = str(a, 'retirement') as BudgetFacts['retirement'] | undefined
  if (ret) {
    f.retirement = ret
    f.retirementMonthly = ret === 'self' ? num(a, 'retirementAmount') : undefined
  }
  if (num(a, 'annualTotal') !== undefined && list(a, 'annualKinds').length > 0) f.annualMonthly = Math.round((num(a, 'annualTotal') as number) / 12)

  if (num(a, 'savingsOnHand') !== undefined) f.liquidSavings = num(a, 'savingsOnHand') as number
  if (num(a, 'emergencyMonths') !== undefined) f.emergencyTargetMonths = num(a, 'emergencyMonths') as number
  const z = str(a, 'zakatMode')
  if (z === 'yes_auto') f.zakatMonthly = Math.round((f.liquidSavings * ZAKAT_RATE) / 12)
  else if (z === 'yes_amount') f.zakatMonthly = num(a, 'zakatAmount') ?? 0
  else if (z === 'no') f.zakatMonthly = 0

  if (list(a, 'priorities').length > 0) f.priorities = list(a, 'priorities') as BudgetFacts['priorities']
  // The starting point someone chose is a stated priority even when they do not tick it again.
  const implied = intent === 'debt' ? 'debt' : intent === 'goal' ? 'goals' : intent === 'save' ? 'safety' : null
  if (implied && !f.priorities.includes(implied)) f.priorities = [implied, ...f.priorities]
  if (num(a, 'securityLean') !== undefined) f.securityLean = num(a, 'securityLean') as number
  if (a.investing === 'already' || a.investing === 'want_to') f.investInterest = true
  if (a.investing === 'already' && num(a, 'investMonthly') !== undefined) f.investMonthly = num(a, 'investMonthly')
  const st = str(a, 'saveTarget')
  if (st && SAVE_PCT[st]) f.saveTargetPct = SAVE_PCT[st]
  else if (st === 'custom' && num(a, 'saveCustom') && income > 0) f.saveTargetPct = clamp((num(a, 'saveCustom') as number) / income, 0, 0.6)
  const cut = list(a, 'cutFirst').flatMap((k) => (CUT_MAP[k] ? [CUT_MAP[k] as EverydayKey] : []))
  const obstacles = list(a, 'saveObstacle').flatMap((k) => (CUT_MAP[k] ? [CUT_MAP[k] as EverydayKey] : []))
  if (cut.length > 0 || obstacles.length > 0) f.cutFirst = [...new Set([...cut, ...obstacles])]
  if (str(a, 'goalVsSafety')) f.goalVsSafety = str(a, 'goalVsSafety') as BudgetFacts['goalVsSafety']
  if (str(a, 'debtStrategy')) f.debtStrategy = str(a, 'debtStrategy') as BudgetFacts['debtStrategy']
  if (num(a, 'debtExtra') !== undefined) f.debtExtra = num(a, 'debtExtra')
  if (num(a, 'arrears') !== undefined && a.behind === true) f.arrears = num(a, 'arrears')

  const debts = answeredDebts(a)
  if (debts.length > 0) f.debts = [...base.debts.filter((d) => !d.id.startsWith('answered-')), ...debts]
  const goals = answeredGoals(a)
  if (goals.length > 0) f.goals = [...base.goals.filter((g) => !g.id.startsWith('answered-')), ...goals]
  return f
}

export function answeredDebts(a: Answers): FactDebt[] {
  const kinds = list(a, 'debtKinds')
  const out: FactDebt[] = []
  const apr = (k: string) => APR[str(a, k) ?? 'unknown'] ?? null
  if (kinds.includes('card') && a.cardPayFull !== true && (num(a, 'cardBalance') ?? 0) > 0)
    out.push({ id: 'answered-card', name: 'Card', kind: 'credit_card', balance: num(a, 'cardBalance') as number, minimum: num(a, 'cardMin') ?? 0, apr: apr('cardApr') })
  if (kinds.includes('loan') && (num(a, 'loanBalance') ?? 0) > 0)
    out.push({ id: 'answered-loan', name: 'Loan', kind: 'loan', balance: num(a, 'loanBalance') as number, minimum: num(a, 'loanMin') ?? 0, apr: apr('loanApr') })
  if (kinds.includes('bnpl') && (num(a, 'bnplMonthly') ?? 0) > 0)
    out.push({ id: 'answered-bnpl', name: 'Instalments', kind: 'installment', balance: (num(a, 'bnplMonthly') as number) * (num(a, 'bnplLeft') ?? 6), minimum: num(a, 'bnplMonthly') as number, apr: 0 })
  if (kinds.includes('family') && (num(a, 'familyOwed') ?? 0) > 0)
    out.push({ id: 'answered-family', name: 'Family and friends', kind: 'personal', balance: num(a, 'familyOwed') as number, minimum: num(a, 'familyMonthly') ?? 0, apr: 0 })
  if (kinds.includes('student') && (num(a, 'studentBalance') ?? 0) > 0)
    out.push({ id: 'answered-student', name: 'Student loan', kind: 'loan', balance: num(a, 'studentBalance') as number, minimum: num(a, 'studentMin') ?? 0, apr: 5 })
  if (kinds.includes('tax') && (num(a, 'taxOwed') ?? 0) > 0)
    out.push({ id: 'answered-tax', name: 'Back taxes', kind: 'personal', balance: num(a, 'taxOwed') as number, minimum: 0, apr: 20 })
  const carSeparate = a.carOverlap === 'separate' || a.carOwnership === 'financed' || a.carOwnership === 'leased'
  if (carSeparate && (num(a, 'carPayment') ?? 0) > 0)
    out.push({ id: 'answered-car', name: 'Car loan', kind: 'loan', balance: 0, minimum: num(a, 'carPayment') as number, apr: null })
  return out
}

export function answeredGoals(a: Answers): FactGoal[] {
  const out: FactGoal[] = []
  const target = num(a, 'goalTargetNew') ?? num(a, 'goalTarget')
  if (target && target > 0) {
    const months = num(a, 'goalMonthsNew') ?? num(a, 'goalMonths')
    const monthly = str(a, 'goalTiming') === 'by_amount' ? num(a, 'goalMonthly') : undefined
    out.push({ id: 'answered-goal-1', name: 'Savings goal', monthly: goalMonthly(target, num(a, 'goalSaved') ?? 0, months, monthly), targetAmount: target, saved: num(a, 'goalSaved') ?? 0, targetDate: null, priority: 1, icon: 'target' })
  }
  const soon = num(a, 'bigSoonAmount')
  if (list(a, 'bigSoon').length > 0 && soon && soon > 0)
    out.push({ id: 'answered-goal-soon', name: 'Coming soon', monthly: goalMonthly(soon, 0, num(a, 'bigSoonMonths') ?? 12, undefined), targetAmount: soon, saved: 0, targetDate: null, priority: 0, icon: 'calendar-clock' })
  if (a.anotherGoal === true && (num(a, 'goal2Target') ?? 0) > 0)
    out.push({ id: 'answered-goal-2', name: 'Second goal', monthly: goalMonthly(num(a, 'goal2Target') as number, 0, num(a, 'goal2Months'), undefined), targetAmount: num(a, 'goal2Target') as number, saved: 0, targetDate: null, priority: 2, icon: 'target' })
  return out
}
