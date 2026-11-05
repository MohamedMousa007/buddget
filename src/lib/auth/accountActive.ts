import { createServiceRoleClient } from '@/lib/supabase/service'

/** A suspension (Auth `banned_until`) or deletion takes effect on the SMS and push routes within this long. */
export const ACCOUNT_ACTIVE_TTL_MS = 60_000
const MAX_ENTRIES = 5000

const verdicts = new Map<string, { active: boolean; until: number }>()

export function resetAccountActiveCache(): void {
  verdicts.clear()
}

/**
 * False for a suspended or deleted account. A locally verified JWT (or a non-expiring SMS ingest token) never asks
 * Auth, so without this a suspended user kept SMS and push access until the token expired. One Auth admin lookup per
 * user per minute per instance, cached either way. Fails open when Auth cannot be reached: a blip must not silently
 * drop the SMS of every user.
 */
export async function isAccountActive(userId: string, now = Date.now()): Promise<boolean> {
  const hit = verdicts.get(userId)
  if (hit && hit.until > now) return hit.active
  try {
    const { data, error } = await createServiceRoleClient().auth.admin.getUserById(userId)
    const gone = !data?.user && (error?.status === 404 || error?.code === 'user_not_found')
    if (error && !gone) return true
    const bannedUntil = data?.user?.banned_until ? Date.parse(data.user.banned_until) : 0
    const active = !gone && !(bannedUntil > now)
    if (verdicts.size >= MAX_ENTRIES) {
      for (const [id, v] of verdicts) if (v.until <= now) verdicts.delete(id)
      if (verdicts.size >= MAX_ENTRIES) verdicts.clear()
    }
    verdicts.set(userId, { active, until: now + ACCOUNT_ACTIVE_TTL_MS })
    return active
  } catch {
    return true
  }
}
