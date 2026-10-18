import type { Goal, SavingsTransaction } from '@/lib/store/types'
import { addMonthsIso, replanOptions, type ReplanOptions } from '@/lib/goals/goalPlan'
import { periodStartMonth, runsSincePlan, type AllocationRun } from '@/lib/goals/goalStatus'

export const CHECKPOINTS = [25, 50, 75, 100] as const

export interface CheckpointNode {
  pct: number
  reached: boolean
  /** `YYYY-MM-DD` reached, or `YYYY-MM-01` projected; null when unknown. */
  date: string | null
  projected: boolean
}

export interface CheckpointInfo {
  nodes: CheckpointNode[]
  /** First unreached checkpoint, or null when done. */
  next: CheckpointNode | null
  /** Whole months until `next` at the plan's pace; null when unknown. */
  monthsToNext: number | null
}

/**
 * Dates each checkpoint was crossed (from the linked pockets' ledger) and projected dates for the rest.
 * `monthlyRate` is what the plan puts in per month in the goal's currency; null = no projection.
 */
export function checkpointInfo(input: {
  goal: Goal
  current: number
  txs: SavingsTransaction[]
  /** Converts a ledger amount into the goal's currency. */
  toGoal: (amount: number, from: SavingsTransaction['currency']) => number
  monthlyRate: number | null
  now: Date
}): CheckpointInfo {
  const { goal, current, txs, toGoal, monthlyRate, now } = input
  const target = goal.targetAmount ?? 0
  const ledger = txs
    .filter((t) => goal.linkedSavingsAccountIds.includes(t.accountId))
    .sort((a, b) => a.date.localeCompare(b.date))

  const reachedOn = (threshold: number): string | null => {
    let cum = 0
    for (const t of ledger) {
      cum += (t.type === 'deposit' ? 1 : -1) * toGoal(t.amount, t.currency)
      if (cum >= threshold) return t.date.slice(0, 10)
    }
    return null
  }

  const nodes = CHECKPOINTS.map((pct): CheckpointNode => {
    const threshold = (target * pct) / 100
    const reached = target > 0 && current >= threshold
    if (reached) return { pct, reached, date: reachedOn(threshold), projected: false }
    const months = monthlyRate && monthlyRate > 0 ? Math.max(1, Math.ceil((threshold - current) / monthlyRate)) : null
    return { pct, reached, date: months === null ? null : addMonthsIso(now, months), projected: true }
  })
  const next = nodes.find((n) => !n.reached) ?? null
  const monthsToNext =
    next && monthlyRate && monthlyRate > 0 ? Math.max(1, Math.ceil(((target * next.pct) / 100 - current) / monthlyRate)) : null
  return { nodes, next, monthsToNext }
}

export interface CoachView {
  behindCount: number
  shortfall: number
  /** `YYYY-MM` the shortfall started. */
  since: string
  options: ReplanOptions
}

/** The two ways back for a goal that has missed cycles. Null when it has no plan or nothing is missed. */
export function coachView(input: {
  goal: Goal
  current: number
  runs: AllocationRun[]
  usualKeep: number | null
  periodSavings: number | null
  now: Date
}): CoachView | null {
  const { goal, current, now } = input
  if (goal.fundingMode === 'manual' || !goal.targetDate) return null
  const runs = [...runsSincePlan(goal, input.runs)].sort((a, b) => a.period.localeCompare(b.period))
  const planned = runs.reduce((s, r) => s + r.planned, 0)
  const paid = runs.reduce((s, r) => s + r.amount, 0)
  const shortfall = planned - paid
  if (runs.length < 2 || shortfall <= 0.05 * (goal.targetAmount ?? 0)) return null
  let behindCount = 0
  let p = 0
  let a = 0
  const flags = runs.map((r) => ((p += r.planned), (a += r.amount), a < p))
  for (let i = flags.length - 1; i >= 0 && flags[i]; i--) behindCount++
  return {
    behindCount,
    shortfall,
    since: runs[runs.length - behindCount].period,
    options: replanOptions({
      remaining: Math.max(0, (goal.targetAmount ?? 0) - current),
      targetDate: goal.targetDate,
      frequency: goal.frequency,
      usualKeep: input.usualKeep,
      periodSavings: input.periodSavings,
      now,
    }),
  }
}

/** Goal patch for "Move the date" or "Keep the date, raise the amount". Both restart the plan today. */
export function replanPatch(
  goal: Goal,
  choice: 'move' | 'keep',
  options: ReplanOptions,
  today: string,
): Partial<Goal> | null {
  if (choice === 'move') return options.moveDate ? { targetDate: options.moveDate.targetDate, planStart: today } : null
  const { perPeriod, sharePct } = options.keepDate
  return goal.fundingMode === 'share' && sharePct !== null
    ? { sharePct: Math.min(100, sharePct), planStart: today }
    : { fundingMode: 'fixed', sharePct: null, monthlyContribution: Math.ceil(perPeriod), planStart: today }
}

/**
 * Cycle history in the goal's own currency, with money the user added by hand counted toward the
 * cycle it landed in. Cron runs store base-currency figures and only what the cron paid, so without
 * this a goal the user funds themselves would read as behind.
 */
export function normalizeRuns(input: {
  goal: Goal
  runs: AllocationRun[]
  txs: SavingsTransaction[]
  /** Base-currency run figures into the goal's currency. */
  baseToGoal: (n: number) => number
  toGoal: (amount: number, from: SavingsTransaction['currency']) => number
}): AllocationRun[] {
  const { goal, runs, txs } = input
  const manual = txs.filter(
    (t) =>
      t.type === 'deposit' &&
      goal.linkedSavingsAccountIds.includes(t.accountId) &&
      t.source !== 'carry' &&
      t.source !== 'goal_opening',
  )
  return runs.map((r) => {
    const start = periodStartMonth(r.period)
    const span = r.period.includes('-Q') ? 3 : 1
    const inCycle = manual.filter((t) => {
      const m = t.date.slice(0, 7)
      if (m < start) return false
      const [y, mo] = start.split('-').map(Number)
      const end = new Date(y, mo - 1 + span, 1)
      return m < `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`
    })
    const extra = inCycle.reduce((s, t) => s + input.toGoal(t.amount, t.currency), 0)
    return { period: r.period, planned: input.baseToGoal(r.planned), amount: input.baseToGoal(r.amount) + extra }
  })
}
