/**
 * Pure evaluation of goal notifications. The behind alert fires once a calendar month, and only after
 * the second missed cycle (never daily). Milestones and completion are emitted where the deposit lands.
 */
import { format } from 'date-fns'
import type { Dictionary } from '@/lib/i18n/types'
import { CHECKPOINTS, coachView } from '@/lib/goals/goalDetail'
import type { AllocationRun } from '@/lib/goals/goalStatus'
import type { Goal } from '@/lib/store/types'
import { formatFixed2 } from '@/lib/utils/formatters'

export type GoalAlert =
  | { type: 'goal_behind'; dedupeKey: string; severity: 'warning'; goalId: string; name: string; count: number; quarterly: boolean; moveTo: string | null; raise: string | null }
  | { type: 'goal_milestone'; dedupeKey: string; severity: 'success'; goalId: string; name: string; pct: number; amount: string }
  | { type: 'goal_achieved'; dedupeKey: string; severity: 'success'; goalId: string; name: string; amount: string }

export interface EvaluateGoalAlertsInput {
  today: Date
  goals: Goal[]
  runsByGoal: Record<string, AllocationRun[]>
  /** Saved per month in each goal's currency; null when unknown. */
  usualKeepFor: (goal: Goal) => number | null
  currentFor: (goal: Goal) => number
  enabled: boolean
}

export function evaluateGoalAlerts(i: EvaluateGoalAlertsInput): GoalAlert[] {
  if (!i.enabled) return []
  const ym = format(i.today, 'yyyy-MM')
  const out: GoalAlert[] = []
  for (const goal of i.goals) {
    if (goal.status !== 'active') continue
    const keep = i.usualKeepFor(goal)
    const q = goal.frequency === 'quarterly'
    const coach = coachView({
      goal,
      current: i.currentFor(goal),
      runs: i.runsByGoal[goal.id] ?? [],
      usualKeep: keep,
      periodSavings: keep === null ? null : keep * (q ? 3 : 1),
      now: i.today,
    })
    if (!coach || coach.behindCount < 2) continue
    out.push({
      type: 'goal_behind',
      dedupeKey: `goal_behind:${goal.id}:${ym}`,
      severity: 'warning',
      goalId: goal.id,
      name: goal.name,
      count: coach.behindCount,
      quarterly: false,
      moveTo: coach.options.moveDate ? format(new Date(`${coach.options.moveDate.targetDate}T00:00:00`), 'MMM yyyy') : null,
      raise: `${goal.currency} ${formatFixed2(Math.ceil(coach.options.keepDate.perPeriod))}`,
    })
  }
  return out
}

/** Checkpoints strictly crossed going from `before` to `after` (amounts toward `target`). */
export function crossedCheckpoints(before: number, after: number, target: number): number[] {
  if (target <= 0) return []
  return CHECKPOINTS.filter((p) => before < (target * p) / 100 && after >= (target * p) / 100)
}

export function goalMilestoneAlert(goal: Goal, pct: number, saved: number): GoalAlert {
  const amount = `${goal.currency} ${formatFixed2(saved)}`
  return pct >= 100
    ? { type: 'goal_achieved', dedupeKey: `goal_achieved:${goal.id}`, severity: 'success', goalId: goal.id, name: goal.name, amount }
    : { type: 'goal_milestone', dedupeKey: `goal_milestone:${goal.id}:${pct}`, severity: 'success', goalId: goal.id, name: goal.name, pct, amount }
}

export function renderGoalAlert(dict: Dictionary, a: GoalAlert): { title: string; body: string } {
  const n = dict.goals.notify
  switch (a.type) {
    case 'goal_behind':
      return { title: n.behindTitle(a.name), body: n.behindBody(a.name, a.count, a.quarterly, a.moveTo, a.raise) }
    case 'goal_milestone':
      return { title: n.milestoneTitle(a.name, a.pct), body: n.milestoneBody(a.name, a.pct, a.amount) }
    case 'goal_achieved':
      return { title: n.achievedTitle(a.name), body: n.achievedBody(a.name, a.amount) }
  }
}
