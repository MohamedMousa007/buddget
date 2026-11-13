import type { LineView, PlanView } from '@/lib/budget/planView.types'

export type PaceState = 'ok' | 'ahead' | 'over'

export interface EverydayPace {
  planned: number
  spent: number
  /** Planned minus spent; negative once the plan is exceeded. */
  left: number
  /** What is left spread over the days left, never negative. */
  perDay: number
  daysLeft: number
  /** Where spend would be today if it followed the plan evenly. */
  expected: number
  aheadBy: number
  state: PaceState
}

/** Spend must run this far above the even line before it reads as "ahead". */
const AHEAD_TOLERANCE = 1.05
/** A big shop on day 1 or 2 says nothing about the month. */
const MIN_DAYS_FOR_PACE = 3

/** Everyday money is the only continuous spend; null when the plan has none. */
export function everydayPace(view: PlanView): EverydayPace | null {
  const { total: planned, spent } = view.blocks.everyday
  if (planned <= 0) return null
  const daysInCycle = Math.max(1, view.daysInCycle)
  const daysLeft = Math.max(0, daysInCycle - view.dayOfCycle)
  const left = planned - spent
  const expected = (planned * view.dayOfCycle) / daysInCycle
  const state: PaceState = spent > planned ? 'over' : view.dayOfCycle >= MIN_DAYS_FOR_PACE && spent > expected * AHEAD_TOLERANCE ? 'ahead' : 'ok'
  return { planned, spent, left, perDay: daysLeft > 0 ? Math.max(0, left) / daysLeft : 0, daysLeft, expected, aheadBy: spent - expected, state }
}

/** The everyday line the money went to most; null while nothing is spent. */
export function topCategory(view: PlanView): { name: string; spent: number } | null {
  const top = [...view.blocks.everyday.lines].sort((a, b) => b.spent - a.spent)[0]
  return top && top.spent > 0 ? { name: top.line.name, spent: top.spent } : null
}

/** Lines spent past their cap. */
export function overBudgetLines(view: PlanView): LineView[] {
  return Object.values(view.blocks)
    .flatMap((b) => b.lines)
    .filter((l) => l.amount > 0 && l.spent > l.amount)
}

const SCHEDULED = ['bills', 'subscriptions', 'debts'] as const

/** Committed money not yet paid this month: only dated payments, not savings transfers. */
export function stillToPay(view: PlanView): { amount: number; count: number; lastDueDay: number | null } {
  let amount = 0
  let count = 0
  let lastDueDay: number | null = null
  for (const block of SCHEDULED) {
    for (const l of view.blocks[block].lines) {
      const owed = l.paid ? 0 : Math.max(0, l.amount - l.spent)
      if (owed <= 0) continue
      amount += owed
      count += 1
      if (l.dueDay != null && (lastDueDay == null || l.dueDay > lastDueDay)) lastDueDay = l.dueDay
    }
  }
  return { amount, count, lastDueDay }
}
