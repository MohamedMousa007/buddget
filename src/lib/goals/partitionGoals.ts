import type { Goal } from '@/lib/store/types'

/** Active unless explicitly paused, achieved or cancelled: a goal synced or imported without a status must not vanish from every tab. */
export function partitionGoals<T extends { goal: Pick<Goal, 'status'> }>(rows: readonly T[]): { running: T[]; paused: T[]; achieved: T[] } {
  return {
    running: rows.filter((r) => r.goal.status !== 'paused' && r.goal.status !== 'achieved' && r.goal.status !== 'cancelled'),
    paused: rows.filter((r) => r.goal.status === 'paused'),
    achieved: rows.filter((r) => r.goal.status === 'achieved'),
  }
}
