import type { Goal } from '@/lib/store/types'

type LegacyGoal = Omit<Goal, 'fundingMode' | 'sharePct' | 'frequency'> &
  Partial<Pick<Goal, 'fundingMode' | 'sharePct' | 'frequency'>>

/** Fill the v3 funding fields on goals from older caches, backups and imports. */
export function withGoalDefaults(g: LegacyGoal): Goal {
  return {
    ...g,
    fundingMode: g.fundingMode ?? 'manual',
    sharePct: g.sharePct ?? null,
    frequency: g.frequency ?? 'monthly',
  }
}
