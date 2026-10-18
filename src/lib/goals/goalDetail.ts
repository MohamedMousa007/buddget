import type { Goal, SavingsTransaction } from '@/lib/store/types'
import { addMonthsIso, replanOptions, type ReplanOptions } from '@/lib/goals/goalPlan'
import { runsSincePlan, type AllocationRun } from '@/lib/goals/goalStatus'

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
  const runs = runsSincePlan(goal, input.runs).sort((a, b) => a.period.localeCompare(b.period))
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
