/** Break-glass access to financial content: how long it lasts and what state a grant is in. */
export const GRANT_MINUTES = 30
export const MIN_REASON = 8
export const MAX_REASON = 500

export interface GrantTimes {
  approved_at: string | null
  expires_at: string | null
  revoked_at: string | null
}

export type GrantState = 'pending' | 'active' | 'expired' | 'revoked'

export function grantState(g: GrantTimes, now: number): GrantState {
  if (g.revoked_at) return 'revoked'
  if (!g.approved_at) return 'pending'
  return g.expires_at && Date.parse(g.expires_at) > now ? 'active' : 'expired'
}

export const grantExpiry = (now: number) => new Date(now + GRANT_MINUTES * 60_000).toISOString()

/** A reason in plain words, or a message saying what is missing. */
export function checkReason(reason: unknown): { ok: true; reason: string } | { ok: false; error: string } {
  const text = typeof reason === 'string' ? reason.trim() : ''
  if (text.length < MIN_REASON) return { ok: false, error: 'Write a short reason first.' }
  return { ok: true, reason: text.slice(0, MAX_REASON) }
}
