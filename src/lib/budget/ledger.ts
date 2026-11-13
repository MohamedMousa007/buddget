import { everydayPace, type PaceState } from '@/lib/budget/monthSummary'
import type { BlockView, LineView, PlanView } from '@/lib/budget/planView.types'
import type { BudgetBlock } from '@/lib/store/types'

/** A move-money line (safety, grow) counts as moved once the cycle's transfers cover this much of it. */
const MOVED_RATIO = 0.9
/** The plan row only mentions a change from last month when it is at least this big. */
export const MIN_CHANGE_PERCENT = 3

export type MonthStatus =
  | { kind: 'empty' }
  | { kind: 'allPaid'; count: number }
  | { kind: 'progress'; done: number; total: number; nextDay: number | null }
  | { kind: 'overLine'; name: string; over: number; ahead: boolean }
  | { kind: 'pace'; state: PaceState }
  | { kind: 'moves'; day: number | null }
  | { kind: 'moved' }
  | { kind: 'goals'; count: number; behind: number; nextTarget: string | null }

export type MonthRight =
  | { kind: 'left'; amount: number; of: number }
  | { kind: 'over'; amount: number; of: number }
  | { kind: 'done'; of: number }
  | { kind: 'toMove'; amount: number }
  | { kind: 'moved' }
  | { kind: 'none' }

export interface MonthRow {
  status: MonthStatus
  right: MonthRight
}

const PAYABLE: readonly BudgetBlock[] = ['bills', 'subscriptions', 'debts']

const left = (b: BlockView): MonthRight =>
  b.spent > b.total ? { kind: 'over', amount: b.spent - b.total, of: b.total } : { kind: 'left', amount: b.total - b.spent, of: b.total }

function nextDueDay(unpaid: LineView[], today: number): number | null {
  const days = unpaid.map((l) => l.dueDay).filter((d): d is number => d != null)
  if (days.length === 0) return null
  const upcoming = days.filter((d) => d >= today)
  return Math.min(...(upcoming.length ? upcoming : days))
}

/** The month-mode ledger row for one segment. `today` is the calendar day of month. */
export function monthRow(view: PlanView, block: BudgetBlock, today: number): MonthRow {
  const b = view.blocks[block]
  const lines = b.lines.filter((l) => l.amount > 0)
  if (lines.length === 0) return { status: { kind: 'empty' }, right: { kind: 'none' } }

  if (PAYABLE.includes(block)) {
    const unpaid = lines.filter((l) => !l.paid)
    if (unpaid.length === 0) return { status: { kind: 'allPaid', count: lines.length }, right: { kind: 'done', of: b.total } }
    return {
      status: { kind: 'progress', done: lines.length - unpaid.length, total: lines.length, nextDay: nextDueDay(unpaid, today) },
      right: left(b),
    }
  }

  if (block === 'everyday') {
    const pace = everydayPace(view)
    const worst = [...lines].filter((l) => l.spent > l.amount).sort((x, y) => y.spent - y.amount - (x.spent - x.amount))[0]
    const ahead = pace?.state === 'ahead' || pace?.state === 'over'
    return {
      status: worst
        ? { kind: 'overLine', name: worst.line.name, over: worst.spent - worst.amount, ahead }
        : { kind: 'pace', state: pace?.state ?? 'ok' },
      right: left(b),
    }
  }

  if (block === 'goals') {
    const goals = view.extras.goals
    const dates = goals.map((g) => g.targetDate).filter((d): d is string => d != null).sort()
    return {
      status: {
        kind: 'goals',
        count: goals.length,
        behind: goals.filter((g) => g.status.tone === 'red' || g.status.tone === 'amber').length,
        nextTarget: dates[0] ?? null,
      },
      right: left(b),
    }
  }

  // safety, grow: money that moves on payday rather than being spent
  const moved = b.spent >= b.total * MOVED_RATIO
  return moved
    ? { status: { kind: 'moved' }, right: { kind: 'moved' } }
    : { status: { kind: 'moves', day: view.extras.paydayDay }, right: { kind: 'toMove', amount: b.total - b.spent } }
}

export interface PlanRow {
  count: number
  /** Share of income, 0-100. */
  share: number
  planned: number
  /** Signed percent against last month's plan; null below the threshold or with no earlier plan. */
  change: number | null
  names: string[]
  held: { months: number; target: number } | null
}

/** Percent change when it is big enough to be worth a line, else null. */
export function significantChange(now: number, before: number | undefined): number | null {
  if (before == null || before <= 0) return null
  const pct = ((now - before) / before) * 100
  return Math.abs(pct) >= MIN_CHANGE_PERCENT ? Math.round(pct) : null
}

/** The plan-mode ledger row for one segment. */
export function planRow(view: PlanView, block: BudgetBlock): PlanRow {
  const b = view.blocks[block]
  const names = block === 'goals' ? view.extras.goals.map((g) => g.name) : b.lines.map((l) => l.line.name)
  return {
    count: block === 'goals' ? view.extras.goals.length : b.lines.length,
    share: b.percent,
    planned: b.total,
    change: significantChange(b.total, view.previousTotals?.[block]),
    names: names.slice(0, 2),
    held: block === 'safety' ? { months: view.extras.safety.monthsHeld, target: view.extras.safety.targetMonths } : null,
  }
}

export interface PlanSplit {
  income: number
  spending: number
  debt: number
  saving: number
  /** Share of income, 0-100. */
  spendingPct: number
  debtPct: number
  savingPct: number
  /** The plan commits more than the income. */
  overIncome: boolean
}

/** Spending (bills, subscriptions, everyday), debt and saving (safety, goals, grow) against income. */
export function planSplit(view: PlanView): PlanSplit {
  const t = view.totals
  const spending = t.bills + t.subscriptions + t.everyday
  const saving = t.safety + t.goals + t.grow
  const pct = (n: number) => (view.income > 0 ? (n / view.income) * 100 : 0)
  return {
    income: view.income,
    spending,
    debt: t.debts,
    saving,
    spendingPct: pct(spending),
    debtPct: pct(t.debts),
    savingPct: pct(saving),
    overIncome: view.free < 0 && !view.balanced,
  }
}
