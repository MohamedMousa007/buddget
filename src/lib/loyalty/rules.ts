/**
 * The loyalty rules, mirrored from SQL (migration 0307: loyalty_tier_key, loyalty_record_week_check, loyalty_gap_uncovered) so the
 * pages can explain them and the tests pin them. The database decides; this module never writes.
 */
import type { TierKey } from './rewardsTypes'

export interface TierRule { key: TierKey; minPoints: number; requiresPro: boolean; requiresFounder: boolean; sortOrder: number }

export const TIERS: readonly TierRule[] = [
  { key: 'silver', minPoints: 0, requiresPro: false, requiresFounder: false, sortOrder: 0 },
  { key: 'emerald', minPoints: 300, requiresPro: false, requiresFounder: false, sortOrder: 1 },
  { key: 'diamond', minPoints: 800, requiresPro: false, requiresFounder: false, sortOrder: 2 },
  { key: 'elite', minPoints: 1500, requiresPro: true, requiresFounder: false, sortOrder: 3 },
  { key: 'founder', minPoints: 1500, requiresPro: true, requiresFounder: true, sortOrder: 4 },
]

export const RECORDS_FOR_KEPT_WEEK = 3
export const MAX_FREEZES = 2
export const WEEK_POINTS = 10
const STEP_X = [1, 1.5, 2] as const
export type MultiplierStep = 0 | 1 | 2

/** The highest tier whose threshold and conditions are met. Elite without Pro falls back to Diamond; points are never lost. */
export function tierFor(lifetimePoints: number, proActive: boolean, founder: boolean, tiers: readonly TierRule[] = TIERS): TierKey {
  let best: TierRule = tiers[0]
  for (const t of tiers) {
    if (lifetimePoints >= t.minPoints && (!t.requiresPro || proActive) && (!t.requiresFounder || founder) && t.sortOrder > best.sortOrder) best = t
  }
  return best.key
}

/** The step a streak earns on its own: x1.5 from week 4, x2 from week 8. */
export const stepForStreak = (streakWeeks: number): MultiplierStep => (streakWeeks >= 8 ? 2 : streakWeeks >= 4 ? 1 : 0)
export const multiplierOf = (step: MultiplierStep): 1 | 1.5 | 2 => STEP_X[step]
export const weekPoints = (step: MultiplierStep): number => Math.round(WEEK_POINTS * STEP_X[step])

/** Kept weeks per earned freeze: 4 from Emerald up, 8 below. */
export const freezeEvery = (tier: TierKey | null): 4 | 8 => (tier && tier !== 'silver' ? 4 : 8)

export interface StreakState { streakWeeks: number; step: MultiplierStep; freezes: number; keptWeeksTotal: number; tier: TierKey | null }

export interface KeepResult extends StreakState { points: number; sparksGift: number; freezesUsed: number }

/**
 * One kept week. `uncoveredGap` = weeks since the last kept one that no repair or seasonal freeze covers (0 for the first week too).
 * Banked freezes cover a gap only if they cover all of it; otherwise the streak restarts at 1 and the multiplier drops one step per
 * uncovered week (never below x1), then rises again with the new streak.
 */
export function keepWeek(prev: StreakState, uncoveredGap: number, firstWeek = false): KeepResult {
  let streak: number
  let step: MultiplierStep = prev.step
  let freezes = prev.freezes
  let freezesUsed = 0
  if (firstWeek) streak = 1
  else if (uncoveredGap === 0) streak = prev.streakWeeks + 1
  else if (uncoveredGap <= freezes) {
    freezes -= uncoveredGap
    freezesUsed = uncoveredGap
    streak = prev.streakWeeks + 1
  } else {
    streak = 1
    step = Math.max(0, step - uncoveredGap) as MultiplierStep
  }
  step = Math.max(step, stepForStreak(streak)) as MultiplierStep
  const keptWeeksTotal = prev.keptWeeksTotal + 1
  if (keptWeeksTotal % freezeEvery(prev.tier) === 0) freezes = Math.min(MAX_FREEZES, freezes + 1)
  return { streakWeeks: streak, step, freezes, keptWeeksTotal, tier: prev.tier, points: weekPoints(step), sparksGift: streakGift(streak), freezesUsed }
}

/** Sparks gifted when a streak reaches 12, 26 or 52 weeks (once each, ever). */
export const streakGift = (streakWeeks: number): number => ({ 12: 10, 26: 20, 52: 40 } as Record<number, number>)[streakWeeks] ?? 0

/** A week counts as kept only with at least 3 records (expenses and income) in it. */
export const isRealWeek = (records: number): boolean => records >= RECORDS_FOR_KEPT_WEEK

/** Spark gifts owed when the tier rises from `giftedRank` to `tier` (Elite Founder pays the Elite gift once). */
export function tierGifts(giftedRank: number, tier: TierKey): Array<{ key: TierKey; sparks: number }> {
  const gifts: Record<TierKey, number> = { silver: 0, emerald: 10, diamond: 20, elite: 30, founder: 0 }
  const rank = Math.min(TIERS.find((t) => t.key === tier)!.sortOrder, 3)
  return TIERS.filter((t) => t.sortOrder > giftedRank && t.sortOrder <= rank && gifts[t.key] > 0).map((t) => ({ key: t.key, sparks: gifts[t.key] }))
}
