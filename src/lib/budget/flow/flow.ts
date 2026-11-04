import { get, has, num, stability } from './derive'
import { NODES } from './nodes'
import type { FlowIntent, FlowModule, FlowNode, FlowState, FlowValue } from './types'

/** The order the modules are walked in. The intent decides which module comes first, so the first questions match why the user came. */
export const MODULE_ORDER: Record<FlowIntent, readonly FlowModule[]> = {
  save: ['found', 'income', 'housing', 'household', 'life', 'debts', 'security', 'goals', 'annual', 'priorities'],
  goal: ['found', 'income', 'goals', 'housing', 'household', 'life', 'debts', 'security', 'annual', 'priorities'],
  debt: ['found', 'income', 'debts', 'housing', 'household', 'life', 'security', 'goals', 'annual', 'priorities'],
  mixed: ['found', 'income', 'housing', 'household', 'life', 'debts', 'security', 'goals', 'annual', 'priorities'],
}

/** Which module an intent cares about most; its standard questions rank higher when the run is short. */
const FOCUS: Record<FlowIntent, readonly FlowModule[]> = {
  save: ['security', 'life'],
  goal: ['goals', 'security'],
  debt: ['debts', 'security'],
  mixed: [],
}

/** Standard (not core, not follow-up) questions one run may ask. Core questions and unlocked follow-ups are never cut. */
const STD_BUDGET = 4

export const createFlow = (intent: FlowIntent, known: Record<string, FlowValue> = {}): FlowState => {
  const s: FlowState = { intent, a: {}, known: { ...known }, skipped: [], cursor: 0 }
  if (intent === 'debt') s.a.hasDebts = true
  if (intent === 'goal') s.a.hasGoal = true
  return s
}

const isInterrupt = (x: FlowNode) => x.needs !== undefined
const done = (s: FlowState, x: FlowNode) => x.id in s.a || s.skipped.includes(x.id)
/** A value the app already holds answers the question, unless the question is a confirmation card. */
const isKnown = (s: FlowState, x: FlowNode) => x.control !== 'confirm' && s.known[x.id] !== undefined

const passed = (s: FlowState, x: FlowNode) => !isInterrupt(x) && MODULE_ORDER[s.intent].indexOf(x.mod) < s.cursor
/**
 * The longer a run gets, the more a question has to matter to be asked. Keeps long scenarios (many debts, kids, goals)
 * from turning into a form: late in a run only questions that move the plan a lot, and the checks, still appear.
 */
function stakeFloor(s: FlowState): number {
  const asked = new Set([...Object.keys(s.a), ...s.skipped].map((id) => NODES.find((x) => x.id === id)?.group ?? id)).size
  return asked < 10 ? 0 : asked < 14 ? 0.3 : asked < 18 ? 0.4 : 0.55
}
export const worthAsking = (s: FlowState, x: FlowNode) => x.tier === 'core' || isInterrupt(x) || x.stake >= stakeFloor(s)
const pending = (s: FlowState, x: FlowNode) => !done(s, x) && !isKnown(s, x) && !passed(s, x) && worthAsking(s, x) && (x.when ? x.when(s) : true)

const advance = (s: FlowState, id: string): number => {
  const x = NODES.find((n) => n.id === id)
  return x && !isInterrupt(x) ? Math.max(s.cursor, MODULE_ORDER[s.intent].indexOf(x.mod)) : s.cursor
}

function stdAllowed(s: FlowState): Set<string> {
  const std = NODES.filter((x) => x.tier === 'std' && !isInterrupt(x))
  const asked = std.filter((x) => done(s, x)).length
  const room = Math.max(0, STD_BUDGET - asked)
  const focus = FOCUS[s.intent]
  const ranked = std
    .filter((x) => pending(s, x))
    .sort((a, b) => b.stake * (focus.includes(b.mod) ? 1.6 : 1) - a.stake * (focus.includes(a.mod) ? 1.6 : 1))
  return new Set(ranked.slice(0, room).map((x) => x.id))
}

/** The next question, or undefined when the flow is complete. Walks the intent's module order; checks that need the whole picture fire at module boundaries. */
export function nextQuestion(s: FlowState): FlowNode | undefined {
  const allowed = stdAllowed(s)
  const order = MODULE_ORDER[s.intent]
  const finished: FlowModule[] = []
  for (const m of order) {
    const here = NODES.find((x) => x.mod === m && !isInterrupt(x) && pending(s, x) && (x.tier !== 'std' || allowed.has(x.id)))
    if (here) return here
    finished.push(m)
    const check = NODES.find((x) => isInterrupt(x) && pending(s, x) && (x.needs ?? []).every((d) => finished.includes(d)))
    if (check) return check
  }
  return undefined
}

export function answer(s: FlowState, id: string, value: FlowValue): FlowState {
  const next: FlowState = { ...s, a: { ...s.a, [id]: value }, skipped: s.skipped.filter((k) => k !== id), cursor: advance(s, id) }
  // "That's not right" on a confirmation card drops what the app knew, so the real question is asked.
  if (value === false && id.startsWith('confirm')) {
    const known = { ...next.known }
    if (id === 'confirmIncome') delete known.income
    if (id === 'confirmDebts') {
      known.knownDebtCount = 0
      known.knownDebtMinimum = 0
      known.knownDebtBalance = 0
    }
    if (id === 'confirmGoals') known.knownGoalCount = 0
    if (id === 'confirmBills') known.knownBillCount = 0
    next.known = known
  }
  return next
}

export function skip(s: FlowState, id: string): FlowState {
  return s.skipped.includes(id) ? s : { ...s, skipped: [...s.skipped, id], cursor: advance(s, id) }
}


/** Starting value for a control when nothing is known: shown, never saved until the person continues. */
export function defaultFor(x: FlowNode, s: FlowState): FlowValue | undefined {
  if (s.a[x.id] !== undefined) return s.a[x.id]
  switch (x.id) {
    case 'payday': return 25
    case 'dependents': return 1
    case 'emergencyMonths': return stability(s) !== 'fixed' || num(s, 'dependents') >= 1 ? 6 : 3
    case 'goalMonths': case 'goal2Months': case 'bigSoonMonths': return 12
    case 'goalMonthsNew': return 24
    case 'securityLean': return has(s, 'priorities', 'safety') || has(s, 'priorities', 'debt') ? 35 : 50
    case 'taxPct': return 15
    case 'mortgageYears': return 15
    case 'bnplLeft': return 6
    case 'partnerSharePct': return 50
  }
  if (x.control === 'confirm') return true
  if (x.control === 'multi') return []
  if (x.control === 'slider') return 50
  if (x.control === 'stepper') return x.min ?? 0
  return undefined
}

/** The six coarse stages the progress bar shows. */
export const STAGES = ['you', 'home', 'life', 'debts', 'secure', 'priorities'] as const
export type FlowStage = (typeof STAGES)[number]
const STAGE_OF: Record<FlowModule, FlowStage> = {
  found: 'you', income: 'you', housing: 'home', household: 'home', life: 'life', debts: 'debts', security: 'secure', goals: 'secure', annual: 'secure', priorities: 'priorities',
}
export const stageOf = (m: FlowModule): FlowStage => STAGE_OF[m]

/** The nodes that make up the run right now: answered or known ones, and those still waiting to be asked. */
export function flowItems(s: FlowState) {
  const allowed = stdAllowed(s)
  return NODES.filter((x) => !isInterrupt(x) && (x.when ? x.when(s) : true)).flatMap((x) => {
    const state = x.id in s.a ? 'answered' : isKnown(s, x) ? 'known' : s.skipped.includes(x.id) ? 'skipped' : passed(s, x) ? null : pending(s, x) && (x.tier !== 'std' || allowed.has(x.id)) ? 'pending' : null
    return state ? [{ node: x, state } as const] : []
  })
}

/** How well the answers so far pin the plan down. Skipped answers count half, since the plan uses a typical value. */
export function flowReadiness(s: FlowState): { percent: number; canBuild: boolean; enough: boolean } {
  const items = flowItems(s)
  const total = items.reduce((t, i) => t + i.node.stake, 0)
  const residual = items.reduce((t, i) => t + i.node.stake * (i.state === 'pending' ? 1 : i.state === 'skipped' ? 0.5 : 0), 0)
  const percent = total === 0 ? 100 : Math.round((1 - residual / total) * 100)
  const canBuild = (num(s, 'income') > 0) && (get(s, 'housing') !== undefined)
  return { percent, canBuild, enough: canBuild && percent >= 85 }
}

/**
 * The part of a free-text description that is a real question for this person. Answers are judged in question order, so
 * a "yes" unlocks the amounts that follow it, and anything the app already holds is not answered a second time.
 */
export function acceptDescribed(s: FlowState, found: Record<string, FlowValue>): { state: FlowState; kept: string[] } {
  let acc = s
  const kept: string[] = []
  for (const x of NODES) {
    const v = found[x.id]
    if (v === undefined || x.control === 'confirm' || isKnown(acc, x) || (x.when && !x.when(acc))) continue
    acc = answer(acc, x.id, v)
    kept.push(x.id)
  }
  if (found.commitments !== undefined) {
    acc = answer(acc, 'commitments', found.commitments)
    kept.push('commitments')
  }
  return { state: acc, kept }
}

const isGroupMember = (head: FlowNode) => (x: FlowNode) => x.group === head.group

/**
 * The fields on one screen: the question asked, plus the related ones its answers unlock, revealed one at a time as the
 * parent gets a value. `values` and `skips` are what the person has entered on this screen so far. When `reopen` is set the
 * person is changing an earlier answer, so the group is rebuilt from its own answers rather than from what is still unasked.
 */
export function screenNodes(s: FlowState, head: FlowNode, values: Record<string, FlowValue>, skips: readonly string[], reopen = false): FlowNode[] {
  const members = NODES.filter(isGroupMember(head))
  let sim = reopen ? { ...s, a: Object.fromEntries(Object.entries(s.a).filter(([k]) => !members.some((m) => m.id === k))), skipped: s.skipped.filter((k) => !members.some((m) => m.id === k)) } : s
  const out: FlowNode[] = []
  for (const x of members) {
    const open = x.id === head.id || (reopen ? !isInterrupt(x) && (x.when ? x.when(sim) : true) : pending(sim, x))
    if (!open) continue
    out.push(x)
    if (skips.includes(x.id)) sim = skip(sim, x.id)
    else {
      const v = values[x.id] ?? defaultFor(x, sim)
      // Nothing chosen yet: related fields wait for it.
      if (v === undefined) break
      sim = answer(sim, x.id, v)
    }
  }
  return out
}

/**
 * Drops answers to questions that no longer apply after an earlier answer was changed (an owner who becomes a renter
 * keeps no mortgage payment). Repeats until nothing more falls away, since a dropped answer can unlock nothing else.
 */
export function pruneInapplicable(s: FlowState): FlowState {
  let cur = s
  for (let pass = 0; pass < 6; pass++) {
    const stale = NODES.filter((x) => (x.id in cur.a || cur.skipped.includes(x.id)) && x.control !== 'confirm' && x.when && !x.when(cur)).map((x) => x.id)
    if (stale.length === 0) return cur
    cur = { ...cur, a: Object.fromEntries(Object.entries(cur.a).filter(([k]) => !stale.includes(k))), skipped: cur.skipped.filter((k) => !stale.includes(k)) }
  }
  return cur
}
