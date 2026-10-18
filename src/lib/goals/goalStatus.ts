import type { Goal } from '@/lib/store/types'

export type GoalStatusKind =
  | 'paused' | 'over' | 'due' | 'behind' | 'oneDeposit' | 'streak' | 'next'

export interface AllocationRun {
  /** `YYYY-MM` or `YYYY-Qn` */
  period: string
  planned: number
  amount: number
}

export interface GoalStatusInput {
  goal: Goal
  /** Amount saved so far (spend so far for limit goals). */
  current: number
  /** Completed cycles only, any order. */
  runs: AllocationRun[]
  now: Date
}

export interface GoalStatusView {
  kind: GoalStatusKind
  icon: 'AlertTriangle' | 'Calendar' | 'Check' | 'Flame' | 'Flag' | 'Pause'
  tone: 'red' | 'ink' | 'amber' | 'green' | 'muted'
  button: { action: 'adjust' | 'review' | 'replan' | 'addMoney' | 'resume'; variant: 'default' | 'outline' }
  /** Values for the localized line (count = months/quarters/days, amount, pct, toGo). */
  params: { count?: number; amount?: number; pct?: number; toGo?: number }
}

const DAY = 86_400_000
const CHECKPOINTS = [25, 50, 75, 100]

function trailing(runs: AllocationRun[], pred: (cumPlanned: number, cumAmount: number, r: AllocationRun) => boolean) {
  const sorted = [...runs].sort((a, b) => a.period.localeCompare(b.period))
  let p = 0
  let a = 0
  const flags = sorted.map((r) => {
    p += r.planned
    a += r.amount
    return pred(p, a, r)
  })
  let n = 0
  for (let i = flags.length - 1; i >= 0 && flags[i]; i--) n++
  return { n, shortfall: p - a }
}

export function getGoalStatus({ goal, current, runs, now }: GoalStatusInput): GoalStatusView {
  if (goal.status === 'paused') {
    return { kind: 'paused', icon: 'Pause', tone: 'muted', button: { action: 'resume', variant: 'default' }, params: {} }
  }
  if (goal.category === 'spending_control' && goal.monthlySpendingLimit != null && current > goal.monthlySpendingLimit) {
    return {
      kind: 'over', icon: 'AlertTriangle', tone: 'red',
      button: { action: 'adjust', variant: 'outline' },
      params: { amount: current - goal.monthlySpendingLimit },
    }
  }
  const target = goal.targetAmount ?? 0
  if (goal.targetDate && goal.status === 'active') {
    const days = Math.ceil((new Date(`${goal.targetDate}T00:00:00`).getTime() - now.getTime()) / DAY)
    if (days <= 30) {
      return { kind: 'due', icon: 'Calendar', tone: 'ink', button: { action: 'review', variant: 'outline' }, params: { count: Math.max(0, days) } }
    }
  }
  const hasPlan = goal.fundingMode !== 'manual'
  if (hasPlan && runs.length >= 2) {
    const behind = trailing(runs, (p, a) => a < p)
    if (behind.n > 0 && behind.shortfall > 0.05 * target) {
      return { kind: 'behind', icon: 'AlertTriangle', tone: 'amber', button: { action: 'replan', variant: 'default' }, params: { count: behind.n } }
    }
  }
  const lastPlanned = [...runs].sort((a, b) => b.period.localeCompare(a.period))[0]?.planned ?? 0
  const deposit = goal.fundingMode === 'fixed' ? (goal.monthlyContribution ?? 0) : lastPlanned
  const remaining = Math.max(0, target - current)
  if (hasPlan && deposit > 0 && remaining > 0 && remaining <= deposit) {
    return { kind: 'oneDeposit', icon: 'Check', tone: 'green', button: { action: 'addMoney', variant: 'default' }, params: {} }
  }
  if (hasPlan) {
    const streak = trailing(runs, (_p, _a, r) => r.planned > 0 && r.amount >= r.planned)
    if (streak.n >= 3) {
      return { kind: 'streak', icon: 'Flame', tone: 'amber', button: { action: 'addMoney', variant: 'outline' }, params: { count: streak.n } }
    }
  }
  const pct = target > 0 ? (current / target) * 100 : 0
  const next = CHECKPOINTS.find((c) => c > pct) ?? 100
  return {
    kind: 'next', icon: 'Flag', tone: 'ink', button: { action: 'addMoney', variant: 'outline' },
    params: { pct: next, toGo: Math.max(0, (target * next) / 100 - current) },
  }
}
