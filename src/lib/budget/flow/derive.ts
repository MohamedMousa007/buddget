import type { FlowState, FlowValue } from './types'

export const get = (s: FlowState, id: string): FlowValue | undefined => s.a[id] ?? s.known[id]
export const is = (s: FlowState, id: string, v: FlowValue) => get(s, id) === v
export const has = (s: FlowState, id: string, v: string) => {
  const x = get(s, id)
  return Array.isArray(x) && x.includes(v)
}
export const num = (s: FlowState, id: string) => Number(get(s, id)) || 0
const answered = (s: FlowState, id: string) => id in s.a
const FREQ_DIV: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 }

export type Stability = 'fixed' | 'variable' | 'mixed'

/** Pay stability follows from the kind of income; only salaried people are asked. */
export function stability(s: FlowState): Stability {
  const t = get(s, 'incomeType')
  if (t === 'freelance' || t === 'business' || t === 'seasonal') return 'variable'
  if (t === 'mixed') return 'mixed'
  if (t === 'benefits' || t === 'allowance') return 'fixed'
  return (get(s, 'incomeStability') as Stability | undefined) ?? 'fixed'
}

/** Income the plan is sized on: the low month for variable earners. */
export function planIncome(s: FlowState): number {
  const base = num(s, 'income')
  const low = num(s, 'lowMonth')
  return stability(s) !== 'fixed' && low > 0 ? Math.min(base, low) : base
}

const partnerShare = (s: FlowState) => (is(s, 'partnerRole', 'shares') ? Math.min(100, Math.max(10, num(s, 'partnerSharePct') || 50)) / 100 : 1)

export function housingMonthly(s: FlowState): number {
  switch (get(s, 'housing')) {
    case 'rent':
      return (num(s, 'rent') / (FREQ_DIV[String(get(s, 'rentFreq') ?? 'monthly')] ?? 1)) * partnerShare(s)
    case 'own':
      return ((is(s, 'ownType', 'mortgage') ? num(s, 'mortgagePayment') : 0) + num(s, 'propertyCosts')) * partnerShare(s)
    case 'family':
      return is(s, 'familyContribution', true) ? num(s, 'familyContributionAmount') : 0
    default:
      return 0
  }
}

export function debtMinimums(s: FlowState): number {
  const kinds = (get(s, 'debtKinds') as string[] | undefined) ?? []
  let t = num(s, 'knownDebtMinimum')
  if (kinds.includes('card') && !is(s, 'cardPayFull', true)) t += num(s, 'cardMin')
  if (kinds.includes('loan')) t += num(s, 'loanMin')
  if (kinds.includes('bnpl')) t += num(s, 'bnplMonthly')
  if (kinds.includes('family')) t += num(s, 'familyMonthly')
  if (kinds.includes('student')) t += num(s, 'studentMin')
  if (is(s, 'carOwnership', 'financed') || is(s, 'carOwnership', 'leased') || is(s, 'carOverlap', 'separate')) t += num(s, 'carPayment')
  return t
}

export const debtCount = (s: FlowState): number => {
  const kinds = (get(s, 'debtKinds') as string[] | undefined) ?? []
  const real = kinds.filter((k) => k !== 'card' || !is(s, 'cardPayFull', true)).length
  return real + num(s, 'knownDebtCount')
}

export function highAprDebt(s: FlowState): boolean {
  const kinds = (get(s, 'debtKinds') as string[] | undefined) ?? []
  const high = (apr: FlowValue | undefined) => apr === 'over25' || apr === '15_25'
  return (
    (kinds.includes('card') && !is(s, 'cardPayFull', true) && (high(get(s, 'cardApr')) || answered(s, 'cardBalance'))) ||
    (kinds.includes('loan') && high(get(s, 'loanApr'))) ||
    kinds.includes('tax') ||
    get(s, 'knownHighApr') === true
  )
}

/** Other fixed monthly obligations the user stated. */
function obligations(s: FlowState): number {
  const sch = is(s, 'youngestChild', 'school') || is(s, 'youngestChild', 'teen') ? num(s, 'schoolFees') : 0
  const care = is(s, 'youngestChild', 'under5') ? num(s, 'childcare') : 0
  const health = is(s, 'healthCover', 'full') ? 0 : num(s, 'healthCost') + (is(s, 'chronicMeds', true) ? num(s, 'chronicAmount') : 0)
  const ins = is(s, 'lifeInsurance', true) ? num(s, 'insurancePremium') : 0
  const ret = is(s, 'retirement', 'self') ? num(s, 'retirementAmount') : 0
  return num(s, 'supportAmount') * (is(s, 'supportsOthers', true) ? 1 : 0) + sch + care + health + ins + ret + num(s, 'householdHelpAmount') + num(s, 'otherFixedBills') + num(s, 'subsAmount')
}

/** A rough essentials figure used only to decide which checks are worth asking about. The engine does the real sizing. */
export function essentialsEstimate(s: FlowState): number {
  const inc = planIncome(s)
  const kids = Math.min(num(s, 'dependents'), 4)
  const car = is(s, 'transportMode', 'car') ? num(s, 'fuelAndUpkeep') || inc * 0.05 : 0
  return (inc * (0.2 + 0.04 * kids) + car) * partnerShare(s)
}

export function fixedObligations(s: FlowState): number {
  return housingMonthly(s) + debtMinimums(s) + obligations(s)
}

export function slack(s: FlowState): number {
  return planIncome(s) - fixedObligations(s) - essentialsEstimate(s)
}

export function monthsHeld(s: FlowState): number {
  const burn = fixedObligations(s) + essentialsEstimate(s)
  return burn > 0 ? num(s, 'savingsOnHand') / burn : 0
}

/** Monthly amount the first goal needs; 0 when it has no target yet. */
export function goalMonthlyNeed(s: FlowState): number {
  const target = num(s, 'goalTargetNew') || num(s, 'goalTarget')
  if (target <= 0) return 0
  if (is(s, 'goalTiming', 'by_amount')) return num(s, 'goalMonthly')
  const months = Math.max(1, num(s, 'goalMonthsNew') || num(s, 'goalMonths') || 12)
  return Math.max(0, target - num(s, 'goalSaved')) / months
}

export const hasAnyGoal = (s: FlowState) => s.intent === 'goal' || is(s, 'hasGoal', true) || num(s, 'knownGoalCount') > 0
