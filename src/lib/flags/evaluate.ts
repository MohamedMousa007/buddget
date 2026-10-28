export interface FlagRow {
  key: string
  enabled: boolean
  rollout_pct: number
  platforms: string[]
  plan_keys: string[]
}

export interface FlagContext {
  userId: string
  platform: string
  planKey: string
  /** Staff always see a flag that is enabled, whatever its rollout, so the team can test before launch. */
  isStaff: boolean
}

/** Stable 0 to 99 bucket for a user and a flag, so a rollout widens without anyone flipping back. */
export function bucketOf(key: string, userId: string): number {
  let h = 2166136261
  for (const ch of `${key}:${userId}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 100
}

export function flagOn(row: FlagRow | undefined, ctx: FlagContext): boolean {
  if (!row?.enabled) return false
  if (row.platforms.length > 0 && !row.platforms.includes(ctx.platform)) return false
  if (row.plan_keys.length > 0 && !row.plan_keys.includes(ctx.planKey)) return false
  return ctx.isStaff || bucketOf(row.key, ctx.userId) < row.rollout_pct
}
