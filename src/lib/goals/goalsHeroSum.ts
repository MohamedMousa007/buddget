import { goalMonthlyRate } from '@/lib/goals/goalDetail'
import type { Goal } from '@/lib/store/types'
import { tryConvertWithGold, type GoldQuote } from '@/lib/utils/currency'

export interface GoalsHeroRow {
  goal: Goal
  current: number
}

export interface GoalsHeroSum {
  saved: number
  want: number
  /** The monthly pace of the active saving goals, in the base currency. */
  monthly: number
  /** Earliest finish line of an active saving goal (`yyyy-MM-dd`), or null. */
  next: string | null
}

const isSave = (g: Goal) => g.category !== 'spending_control' && g.category !== 'debt_freedom'

/**
 * The Goals hero's totals. Every amount crosses currencies through a real rate (gold through its gram price); a leg with
 * no rate leaves that goal out instead of counting its figure in the wrong unit (a goal in USD read as EGP, say).
 */
export function goalsHeroSum(
  rows: readonly GoalsHeroRow[],
  ctx: { base: string; usualKeep: number | null; rates: Record<string, number>; gold: GoldQuote },
): GoalsHeroSum {
  const { base, usualKeep, rates, gold } = ctx
  const conv = (n: number, from: string, to: string) => tryConvertWithGold(n, from, to, rates, base, gold)
  const save = rows.filter((r) => isSave(r.goal) && r.goal.status !== 'achieved')
  let saved = 0
  let want = 0
  let monthly = 0
  for (const { goal, current } of save) {
    saved += conv(current, goal.currency, base) ?? 0
    want += conv(goal.targetAmount ?? 0, goal.currency, base) ?? 0
    if (goal.status !== 'active') continue
    const keepInGoal = usualKeep === null ? null : conv(usualKeep, base, goal.currency)
    const rate = goalMonthlyRate(goal, keepInGoal)
    monthly += rate == null ? 0 : conv(rate, goal.currency, base) ?? 0
  }
  const next = save.filter((r) => r.goal.status === 'active' && r.goal.targetDate).map((r) => r.goal.targetDate!).sort()[0] ?? null
  return { saved, want, monthly, next }
}
