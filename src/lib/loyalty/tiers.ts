export interface TierThreshold {
  key: string
  min_points: number
}

/** The highest tier whose threshold the lifetime points have reached, or null below the first tier. */
export function tierFor(lifetimePoints: number, tiers: readonly TierThreshold[]): string | null {
  let best: TierThreshold | null = null
  for (const t of tiers) {
    if (lifetimePoints >= t.min_points && (!best || t.min_points > best.min_points)) best = t
  }
  return best?.key ?? null
}
