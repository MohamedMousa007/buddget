/**
 * The Sparks pack bonus, mirrored from `spark_pack_bonus_percent` (migration 0306): paying Pro +15%, Pro at Diamond or above +20%
 * ("loyal Pro"). The larger of the two, never added; Free and the trial get none. The bonus is stored on the same purchase row,
 * so a refund removes it with the pack.
 */
import type { TierKey } from '@/lib/loyalty/rewardsTypes'

export const PRO_PACK_BONUS = 15
export const LOYAL_PRO_PACK_BONUS = 20
const LOYAL_TIERS: ReadonlySet<TierKey> = new Set(['diamond', 'elite', 'founder'])

export function packBonusPercent(payingPro: boolean, tier: TierKey | null): number {
  if (!payingPro) return 0
  return Math.max(PRO_PACK_BONUS, tier && LOYAL_TIERS.has(tier) ? LOYAL_PRO_PACK_BONUS : 0)
}

/** Bonus Sparks on a pack, rounded down like the server. */
export const bonusSparks = (packSparks: number, percent: number): number => Math.floor((packSparks * percent) / 100)

/** Unspent Sparks a refund removes: everything left on the row, bonus included. */
export const refundClawback = (credited: number, spent: number): number => Math.max(0, credited - Math.min(spent, credited))
