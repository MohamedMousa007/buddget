/** Access to a user's financial content: staff ask, only the owner decides, and a grant is one-time or permanent. */
export const GRANT_MINUTES = 30
export const MIN_REASON = 8
export const MAX_REASON = 500
/** A request nobody answered stops waiting after this long. */
export const REQUEST_EXPIRES_DAYS = 7

export type GrantMode = 'one_time' | 'permanent'

export const isGrantMode = (v: unknown): v is GrantMode => v === 'one_time' || v === 'permanent'

export interface GrantTimes {
  mode?: GrantMode | string | null
  requested_at?: string | null
  approved_at: string | null
  expires_at: string | null
  revoked_at: string | null
  denied_at?: string | null
}

export type GrantState = 'pending' | 'active' | 'expired' | 'revoked' | 'denied'

export function grantState(g: GrantTimes, now: number): GrantState {
  if (g.revoked_at) return 'revoked'
  if (g.denied_at) return 'denied'
  if (!g.approved_at) {
    const asked = g.requested_at ? Date.parse(g.requested_at) : now
    return now - asked > REQUEST_EXPIRES_DAYS * 86_400_000 ? 'expired' : 'pending'
  }
  if (g.mode === 'permanent' && !g.expires_at) return 'active'
  return g.expires_at && Date.parse(g.expires_at) > now ? 'active' : 'expired'
}

/** A one-time grant ends after the window; a permanent one never expires until revoked. */
export const grantExpiry = (now: number, mode: GrantMode): string | null =>
  mode === 'permanent' ? null : new Date(now + GRANT_MINUTES * 60_000).toISOString()

/** A reason in plain words, or a message saying what is missing. */
export function checkReason(reason: unknown): { ok: true; reason: string } | { ok: false; error: string } {
  const text = typeof reason === 'string' ? reason.trim() : ''
  if (text.length < MIN_REASON) return { ok: false, error: 'Write a short reason first.' }
  return { ok: true, reason: text.slice(0, MAX_REASON) }
}
