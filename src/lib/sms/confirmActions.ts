import { apiFetchAuth } from '@/lib/apiBase'
import { deviceIdHeader } from '@/lib/native/deviceId'

/**
 * Both routes claim the row atomically, so a repeat call (double tap, retry after a lost response, another device
 * got there first) answers 404 `not_found`. The row is no longer waiting, which is the state the caller wanted.
 */
async function accepted(res: Response): Promise<boolean> {
  if (res.ok) return true
  if (res.status !== 404) return false
  const body = (await res.json?.().catch(() => null)) as { reason?: string } | null
  return body?.reason === 'not_found'
}

/**
 * Confirms a pending sms_parse_log row via /api/sms/confirm (creates the
 * transaction, or finalises the currency on provisional rows). Resolves true when the
 * row is no longer waiting (including already handled); false on any failure — callers keep the item visible and surface an error.
 */
export async function confirmSmsLog(logId: string, currency?: string): Promise<boolean> {
  try {
    const res = await apiFetchAuth('/api/sms/confirm', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(await deviceIdHeader()) },
      body: JSON.stringify(currency ? { logId, currency } : { logId }),
    })
    return await accepted(res)
  } catch {
    return false
  }
}

/** Clears awaiting_confirmation via /api/sms/dismiss (clients cannot write sms_parse_log). Resolves false when it failed. */
export async function dismissSmsLog(logId: string): Promise<boolean> {
  try {
    const res = await apiFetchAuth('/api/sms/dismiss', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(await deviceIdHeader()) },
      body: JSON.stringify({ logId }),
    })
    return await accepted(res)
  } catch {
    return false
  }
}
