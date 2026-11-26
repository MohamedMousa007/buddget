import type { Goal, GoalFrequency } from '@/lib/store/types'
import { periodMonths } from '@/lib/goals/goalPlan'

export type GoalStatusKind =
  | 'paused' | 'over' | 'underLimit' | 'due' | 'behind' | 'oneDeposit' | 'streak' | 'next'

export interface AllocationRun {
  /** `YYYY-MM`, `YYYY-Qn` or `YYYY` */
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

/** `YYYY-MM` of the first month a cycle covers ('2026-Q4' starts 2026-10, '2026' starts 2026-01). */
export function periodStartMonth(period: string): string {
  const q = period.match(/^(\d{4})-Q([1-4])$/)
  if (q) return `${q[1]}-${String((Number(q[2]) - 1) * 3 + 1).padStart(2, '0')}`
  return /^\d{4}$/.test(period) ? `${period}-01` : period
}

/** Months a cycle key covers: 1 ('YYYY-MM'), 3 ('YYYY-Qn') or 12 ('YYYY'). */
export function periodSpan(period: string): 1 | 3 | 12 {
  return /^\d{4}$/.test(period) ? 12 : period.includes('-Q') ? 3 : 1
}

/** The cycle a `YYYY-MM` month belongs to for a goal's frequency: 'YYYY-MM', 'YYYY-Qn' or 'YYYY'. */
export function periodKey(month: string, f: GoalFrequency): string {
  const y = month.slice(0, 4)
  if (f === 'yearly') return y
  if (f === 'quarterly') return `${y}-Q${Math.floor((Number(month.slice(5, 7)) - 1) / 3) + 1}`
  return month.slice(0, 7)
}

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const addMonthsYm = (month: string, n: number) => {
  const d = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1)
  return ym(d)
}

/**
 * The goal's cycles, judged on their due dates only. The cron funds every goal monthly, so a quarterly or yearly goal's
 * monthly runs are summed into its own periods, and a period counts only once it has ended (its due date has passed):
 * the months in between never read as behind. Monthly goals are returned as they are.
 */
export function cycleRuns(frequency: GoalFrequency, runs: AllocationRun[], now: Date): AllocationRun[] {
  if (periodMonths(frequency) === 1) return runs
  const thisMonth = ym(now)
  const sums = new Map<string, AllocationRun>()
  for (const r of runs) {
    const key = periodKey(periodStartMonth(r.period), frequency)
    const s = sums.get(key) ?? { period: key, planned: 0, amount: 0 }
    s.planned += r.planned
    s.amount += r.amount
    sums.set(key, s)
  }
  return [...sums.values()].filter((r) => addMonthsYm(periodStartMonth(r.period), periodSpan(r.period)) <= thisMonth)
}

/** Cycles that count toward behind/streak: those since the plan last changed. */
export function runsSincePlan(goal: Pick<Goal, 'planStart'>, runs: AllocationRun[]): AllocationRun[] {
  const from = goal.planStart?.slice(0, 7)
  return from ? runs.filter((r) => periodStartMonth(r.period) >= from) : runs
}

export function getGoalStatus({ goal, current, runs: allRuns, now }: GoalStatusInput): GoalStatusView {
  const runs = cycleRuns(goal.frequency, runsSincePlan(goal, allRuns), now)
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
  if (goal.category === 'spending_control') {
    return {
      kind: 'underLimit', icon: 'Flag', tone: 'ink', button: { action: 'adjust', variant: 'outline' },
      params: { amount: Math.max(0, (goal.monthlySpendingLimit ?? 0) - current) },
    }
  }
  const target = goal.targetAmount ?? 0
  if (goal.targetDate && goal.status === 'active') {
    const days = Math.ceil((new Date(`${goal.targetDate}T00:00:00`).getTime() - now.getTime()) / DAY)
    if (days <= 30) {
      return { kind: 'due', icon: 'Calendar', tone: 'ink', button: { action: 'review', variant: 'outline' }, params: { count: days } }
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
  // Both amounts are per cycle; the cron deposits monthly, so one deposit is the cycle amount spread over its months.
  const deposit = (goal.fundingMode === 'fixed' ? (goal.monthlyContribution ?? 0) : lastPlanned) / periodMonths(goal.frequency)
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
