import { parseISO } from 'date-fns'
import type { Goal, SavingsTransaction } from '@/lib/store/types'

/** Whole months from creation to completion, at least 1. */
export function monthsTaken(goal: Pick<Goal, 'createdAt' | 'achievedAt'>): number {
  const a = parseISO(goal.createdAt)
  const b = parseISO(goal.achievedAt ?? goal.createdAt)
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()))
}

const depositsInto = (goal: Pick<Goal, 'linkedSavingsAccountIds'>, txs: readonly SavingsTransaction[]) =>
  txs.filter((t) => t.type === 'deposit' && goal.linkedSavingsAccountIds.includes(t.accountId))

/** The longest run of calendar months in a row with at least one deposit. */
function longestMonthRun(dates: readonly string[]): number {
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))].sort()
  let best = 0
  let run = 0
  let prev: number | null = null
  for (const m of months) {
    const idx = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7))
    run = prev !== null && idx === prev + 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = idx
  }
  return best
}

export interface AchievedFacts {
  /** Deposits into the finished goals' pockets. */
  deposits: number
  /** Months the quickest goal took; 0 with no goals. */
  fastestMonths: number
  /** Longest run of months in a row with a deposit, across the finished goals. */
  bestStreak: number
  /** Deposits per goal id, for each row. */
  depositsByGoal: Record<string, number>
}

/** The trophy room's three facts, from the finished goals and the pockets' ledger. */
export function achievedFacts(goals: readonly Goal[], txs: readonly SavingsTransaction[]): AchievedFacts {
  const depositsByGoal: Record<string, number> = {}
  let deposits = 0
  let bestStreak = 0
  for (const g of goals) {
    const mine = depositsInto(g, txs)
    depositsByGoal[g.id] = mine.length
    deposits += mine.length
    bestStreak = Math.max(bestStreak, longestMonthRun(mine.map((t) => t.date)))
  }
  const fastestMonths = goals.length ? Math.min(...goals.map(monthsTaken)) : 0
  return { deposits, fastestMonths, bestStreak, depositsByGoal }
}

/**
 * "You did it" facts for one goal: whole calendar months since it was made (0 when under a month), and the deposits made
 * into its pockets since then. Money the pocket held before the goal, and the goal's own opening amount, are not deposits.
 */
export function goalJourney(
  goal: Pick<Goal, 'createdAt' | 'linkedSavingsAccountIds'>,
  txs: readonly SavingsTransaction[],
  now: Date,
): { months: number; deposits: number } {
  const start = parseISO(goal.createdAt)
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  const fromDay = localDay(start)
  const deposits = depositsInto(goal, txs).filter((t) => t.date.slice(0, 10) >= fromDay && t.source !== 'goal_opening').length
  return { months: Math.max(0, months), deposits }
}

const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
