import type { PaceStatus } from '@/lib/utils/spendingPace'
import { MIN_DAYS, MIN_EXPENSES } from './detectors'
import type { Insight, InsightHero, InsightInput, InsightKind } from './types'

/** The budget figures the hero reads, from the same monthly stats as Flow so the two pages agree. */
export interface PlanFigures {
  budget: number
  /** Where the cycle ends at this pace (committed lines counted once, the rest extrapolated). */
  projected: number
  dailyRate: number
  /** What is left per remaining day to land on the budget. */
  landDaily: number
  status: PaceStatus
}

/** How the running cycle ends, in the one shape the hero, the pace chart and Buddgy's read all use. */
export type HeroVerdict =
  /** Against the budget: `delta` is how far over (or under) it ends. */
  /** `landDaily` is null when it would not help: over budget, yet no lower than today's rate (unpaid bills drive the overrun). */
  | { kind: 'budget'; over: boolean; delta: number; budget: number; projected: number; dailyRate: number; landDaily: number | null; status: PaceStatus; daysLeft: number }
  /** No budget: against the mean of the last 3 cycles. */
  | { kind: 'usual'; more: boolean; delta: number; projected: number; dailyRate: number }
  /** No budget and no history: only where it is heading. */
  | { kind: 'projection'; projected: number; dailyRate: number }
  /** Too early in the cycle to project: what is spent so far. */
  | { kind: 'early'; spent: number; daysMore: number }
  | { kind: 'noIncome' }

export function heroVerdict(input: InsightInput, hero: InsightHero, plan: PlanFigures): HeroVerdict {
  if (hero.state === 'noIncome') return { kind: 'noIncome' }
  if (hero.state === 'learning') return { kind: 'early', spent: input.spent, daysMore: hero.daysMore }
  const { projected, dailyRate } = plan
  if (plan.budget > 0) {
    const delta = Math.round(Math.abs(projected - plan.budget))
    const over = projected > plan.budget
    const landDaily = over && plan.landDaily > 0 && plan.landDaily >= dailyRate ? null : plan.landDaily
    return { kind: 'budget', over, delta, budget: plan.budget, projected, dailyRate, landDaily, status: plan.status, daysLeft: input.cycle.daysLeft }
  }
  if (input.usualSpend !== null && input.usualSpend > 0) {
    return { kind: 'usual', more: projected > input.usualSpend, delta: Math.round(Math.abs(projected - input.usualSpend)), projected, dailyRate }
  }
  return { kind: 'projection', projected, dailyRate }
}

/**
 * How the cycle ends on spending alone, for the pace chart and Buddgy's read. A missing income hides only the hero's
 * "what you can spend each day" answer; where spending is heading against the budget needs no income (approved
 * light-touch Insights, no-income state: the read and the "≈ N by month end" projection still show).
 */
export function paceVerdict(input: InsightInput, hero: InsightHero, plan: PlanFigures): HeroVerdict {
  if (hero.state !== 'noIncome') return heroVerdict(input, hero, plan)
  const { daysElapsed } = input.cycle
  const enough = daysElapsed >= MIN_DAYS && input.expenseCount >= MIN_EXPENSES
  return heroVerdict(input, { ...hero, state: enough ? 'ok' : 'learning', daysMore: Math.max(0, MIN_DAYS - daysElapsed) }, plan)
}

export type HeroTileKey = 'mainReason' | 'beforePayday' | 'unusualBuy' | 'bigDay'

export interface HeroTile {
  key: HeroTileKey
  /** Null when the finding has nothing to say yet: the tile stays quiet, never locked. */
  insight: Insight | null
  /** A Pro finding that exists, for a Free member: shown with its figure hidden. */
  locked: boolean
}

const TILE_KINDS: Record<HeroTileKey, readonly InsightKind[]> = {
  mainReason: ['categoryShift', 'topCategory'],
  beforePayday: ['billsBeforePayday'],
  unusualBuy: ['unusualPurchase'],
  bigDay: ['weekdayPattern'],
}

/** The four findings that explain the cycle. Locks only what exists and is Pro, so the "N more in Pro" count is honest. */
export function heroTiles(insights: readonly Insight[], advanced: boolean): HeroTile[] {
  return (Object.keys(TILE_KINDS) as HeroTileKey[]).map((key) => {
    const insight = TILE_KINDS[key].map((k) => insights.find((f) => f.kind === k)).find((f) => f !== undefined) ?? null
    return { key, insight, locked: insight !== null && insight.pro === true && !advanced }
  })
}

/** Findings a Free member cannot read: drives every "N more findings" line from one rule. */
export const lockedFindings = (insights: readonly Insight[], advanced: boolean) => (advanced ? [] : insights.filter((f) => f.pro === true))

export interface LearningProgress {
  days: number
  daysNeeded: number
  purchases: number
  purchasesNeeded: number
  /** 0..100, the slower of the two counts. */
  pct: number
  daysMore: number
}

/** How far the running cycle is from enough data to speak, by days and by purchases. */
export function learningProgress(input: InsightInput): LearningProgress {
  const days = Math.min(MIN_DAYS, Math.max(0, input.cycle.daysElapsed))
  const purchases = Math.min(MIN_EXPENSES, Math.max(0, input.expenseCount))
  const pct = Math.round(Math.min(days / MIN_DAYS, purchases / MIN_EXPENSES) * 100)
  return { days, daysNeeded: MIN_DAYS, purchases, purchasesNeeded: MIN_EXPENSES, pct, daysMore: MIN_DAYS - days }
}
