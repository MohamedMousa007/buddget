import { requireSupabaseSecretKey, requireSupabaseUrl } from '@/lib/supabase/env'

/**
 * Tells every signed-in device of `userId` that something changed, over their private broadcast channel. The devices
 * answer with one small delta pull. Best effort and at-most-once by design: a missed nudge is covered by the push
 * notification and by the pull that runs whenever the app opens or resumes.
 */
export async function nudgeUser(userId: string, event: 'sms' | 'sync', payload: Record<string, unknown> = {}): Promise<boolean> {
  const key = requireSupabaseSecretKey()
  try {
    const res = await fetch(`${requireSupabaseUrl()}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: `user:${userId}`, event, payload, private: true }] }),
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) console.warn('[nudge] broadcast answered', res.status)
    return res.ok
  } catch (e) {
    console.warn('[nudge] broadcast failed', e instanceof Error ? e.message : e)
    return false
  }
}
