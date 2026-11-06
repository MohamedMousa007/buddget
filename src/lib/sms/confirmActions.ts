import { apiFetchAuth } from '@/lib/apiBase'
import { deviceIdHeader } from '@/lib/native/deviceId'

/**
 * Confirms a pending sms_parse_log row via /api/sms/confirm (creates the
 * transaction, or finalises the currency on provisional rows). Resolves false
 * on any failure — callers keep the item visible and surface an error.
 */
export async function confirmSmsLog(logId: string, currency?: string): Promise<boolean> {
  try {
    const res = await apiFetchAuth('/api/sms/confirm', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(await deviceIdHeader()) },
      body: JSON.stringify(currency ? { logId, currency } : { logId }),
    })
    return res.ok
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
    return res.ok
  } catch {
    return false
  }
}
