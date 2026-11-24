import { ANSWERABLE } from '@/lib/budget/situationAi'
import { acceptDescribed, answer } from './flow'
import type { KnownSource } from './known'
import { NODE_BY_ID } from './nodes'
import type { ConflictChoice, FlowConflict, FlowState, FlowValue, PendingDescription } from './types'

const FREQ_DIV: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 }
/** Typed figures are rough: inside this share of the larger figure they agree. */
const AMOUNT_TOLERANCE = 0.1
/** Debt fields a typed description can carry, dropped together when the person says they are the tracked ones. */
const DEBT_FIELDS = ['hasDebts', 'debtKinds', 'cardPayFull', 'cardBalance', 'cardMin', 'loanBalance', 'loanMin', 'bnplMonthly', 'familyOwed', 'studentBalance', 'studentMin', 'taxOwed', 'behind', 'arrears']

const asNum = (v: FlowValue | undefined) => (typeof v === 'number' ? v : Number(v) || 0)

/** The typed figure as a monthly amount, so it compares with what the app holds (rent is stored monthly). */
function typedMonthly(id: string, v: number, found: Record<string, FlowValue>): number {
  return id === 'rent' ? v / (FREQ_DIV[String(found.rentFreq ?? 'monthly')] ?? 1) : v
}

/** Two money figures disagree when they are apart by more than 10% of the larger one, and by more than a rounding. */
export function amountsDiffer(app: number, typed: number, income: number): boolean {
  if (app === typed) return false
  if (app === 0 || typed === 0) return true
  return Math.abs(app - typed) > Math.max(AMOUNT_TOLERANCE * Math.max(app, typed), 0.01 * income, 1)
}

function differs(id: string, app: FlowValue, typed: FlowValue, found: Record<string, FlowValue>, income: number): boolean {
  if (NODE_BY_ID.get(id)?.control === 'amount' && typeof typed === 'number') return amountsDiffer(asNum(app), typedMonthly(id, typed, found), income)
  if (Array.isArray(app) || Array.isArray(typed)) return [app].flat().map(String).sort().join() !== [typed].flat().map(String).sort().join()
  return app !== typed
}

/**
 * Where the description disagrees with what the app holds. Nothing here is picked silently: each one is shown to the
 * person as a choice between the two. Values that agree (inside the tolerance) are not conflicts; the app's value stays.
 */
export function detectConflicts(s: FlowState, found: Record<string, FlowValue>, sources: Record<string, KnownSource> = {}): FlowConflict[] {
  const out: FlowConflict[] = []
  const income = asNum(s.known.income ?? found.income)
  for (const id of ANSWERABLE) {
    const app = s.known[id]
    const typed = found[id]
    if (app === undefined || typed === undefined || id in s.a) continue
    // A typed rent carries its own frequency: one choice for both, so a remembered frequency never meets a new amount.
    if (id === 'rentFreq' && found.rent !== undefined) continue
    if (differs(id, app, typed, found, income)) out.push({ id, app, typed, source: sources[id] ?? 'tracked' })
  }
  const debts = asNum(s.known.knownDebtCount)
  if (debts > 0 && found.hasDebts === false) out.push({ id: 'hasDebts', app: debts, typed: false, source: 'tracked' })
  if (debts > 0 && found.hasDebts === true) out.push({ id: 'moreDebts', app: debts, typed: found.debtKinds ?? [], source: 'tracked' })
  const goals = asNum(s.known.knownGoalCount)
  if (goals > 0 && found.hasGoal === false) out.push({ id: 'hasGoal', app: goals, typed: false, source: 'tracked' })
  return out
}

/** The description waiting for the person's choices, or null when nothing disagrees. */
export function pendingFor(s: FlowState, found: Record<string, FlowValue>, sources: Record<string, KnownSource>, unconverted?: string): PendingDescription | null {
  const conflicts = detectConflicts(s, found, sources)
  return conflicts.length > 0 ? { found, conflicts, choices: {}, ...(unconverted ? { unconverted } : {}) } : null
}

export function choose(p: PendingDescription, id: string, choice: ConflictChoice): PendingDescription {
  return { ...p, choices: { ...p.choices, [id]: choice } }
}

/** The first conflict still waiting for an answer. */
export const nextConflict = (p: PendingDescription): FlowConflict | undefined => p.conflicts.find((c) => p.choices[c.id] === undefined)

/**
 * Lays the person's choices onto the run, then the rest of the description. Choosing the typed value lets it answer the
 * question (the app's value no longer blocks it); choosing the app's value drops the typed one. Unchosen conflicts keep the
 * app's value, which is only reached through an explicit "keep my records".
 */
export function resolveDescription(s: FlowState, p: PendingDescription): { state: FlowState; kept: string[]; dropped: string[]; keptApp: string[]; keptRecords: string[] } {
  let st: FlowState = { ...s, pending: undefined }
  const found = { ...p.found }
  const keptApp: string[] = []
  /** Where the person's figure differed from the app's and the app's stayed: marked "Kept your records". */
  const keptRecords: string[] = []
  const extraDropped: string[] = []
  for (const c of p.conflicts) {
    const typed = (p.choices[c.id] ?? 'app') === 'typed'
    if (c.id === 'hasDebts') {
      if (typed) st = answer(st, 'confirmDebts', false)
      else delete found.hasDebts
    } else if (c.id === 'moreDebts') {
      if (typed) found.moreDebts = true
      else for (const f of DEBT_FIELDS) delete found[f]
    } else if (c.id === 'hasGoal') {
      if (typed) st = answer(st, 'confirmGoals', false)
      else delete found.hasGoal
    } else if (typed) {
      const known = { ...st.known }
      delete known[c.id]
      st = { ...st, known }
    } else {
      delete found[c.id]
      if (c.id === 'rent') delete found.rentFreq
      // Rent that includes utilities leaves no separate utilities bill, so a typed one is not used.
      if (c.id === 'rentIncludesUtilities' && found.utilities !== undefined) {
        delete found.utilities
        extraDropped.push('utilities')
      }
      keptApp.push(c.id)
      keptRecords.push(c.id)
    }
  }
  // A typed rent that will be used brings its frequency (monthly unless the text said otherwise) and its housing, so a
  // remembered frequency cannot multiply it and a profile-only renter's plan reads it.
  if (found.rent !== undefined && st.known.rent === undefined) {
    found.rentFreq ??= 'monthly'
    found.housing ??= st.known.housing ?? 'rent'
    const known = { ...st.known }
    delete known.rentFreq
    delete known.housing
    st = { ...st, known }
  }
  // A described income that matches (or was kept as) the tracked one confirms it, so the confirmation card is not shown.
  if (p.found.income !== undefined && st.known.income !== undefined && !('confirmIncome' in st.a)) st = answer(st, 'confirmIncome', true)
  // What the description said and the app already held alike is shown as picked up too; a figure that differed a little is marked kept.
  const asked = new Set(p.conflicts.map((c) => c.id))
  for (const id of ANSWERABLE) {
    if (found[id] === undefined || st.known[id] === undefined || asked.has(id)) continue
    keptApp.push(id)
    if (JSON.stringify(found[id]) !== JSON.stringify(st.known[id])) keptRecords.push(id)
  }
  const { state, kept, dropped } = acceptDescribed(st, found)
  return { state, kept, dropped: [...dropped, ...extraDropped], keptApp, keptRecords }
}
