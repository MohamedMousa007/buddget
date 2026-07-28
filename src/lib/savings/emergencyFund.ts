/**
 * Emergency fund (§4): how many months of *essentials* the cover pockets can carry.
 *
 * "Essentials" is the SIMPLE month — rent, food, transport, bills, debt minimums — explicitly NOT
 * the user's full budget. Cover is the sum of the pockets the user marked as cover, and it is
 * claimed BEFORE any goal can take a pound. All divisions guarded: no Infinity, no −0.
 */

export interface EmergencyFundInput {
  /** Sum of pocket balances flagged as emergency cover, base currency. */
  coverAmount: number
  /** Simple monthly essentials, base currency. */
  monthlyEssentials: number
  /** Target months of cover (1–24). */
  targetMonths: number
}

export interface EmergencyFundResult {
  monthsCovered: number
  neededForTarget: number
  /** Shortfall in base currency vs the target (0 when at/above target). */
  gap: number
  atOrAboveTarget: boolean
}

export function computeEmergencyFund(input: EmergencyFundInput): EmergencyFundResult {
  const cover = Math.max(0, input.coverAmount)
  const essentials = Math.max(0, input.monthlyEssentials)
  const target = Math.max(0, input.targetMonths)

  // No essentials → nothing to cover; the concept is vacuously satisfied (avoid Infinity months).
  if (essentials <= 0) {
    return { monthsCovered: 0, neededForTarget: 0, gap: 0, atOrAboveTarget: true }
  }

  const monthsCovered = cover / essentials
  const neededForTarget = target * essentials
  const gap = Math.max(0, neededForTarget - cover)
  return { monthsCovered, neededForTarget, gap, atOrAboveTarget: cover >= neededForTarget }
}
