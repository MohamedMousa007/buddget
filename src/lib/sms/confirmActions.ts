import { createClient } from '@/lib/supabase/client'
import { apiFetchAuth } from '@/lib/apiBase'

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currency ? { logId, currency } : { logId }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Clears awaiting_confirmation directly. Resolves false when the update failed. */
export async function dismissSmsLog(logId: string): Promise<boolean> {
  try {
    const { error } = await createClient()
      .from('sms_parse_log')
      .update({ awaiting_confirmation: false })
      .eq('id', logId)
    return !error
  } catch {
    return false
  }
}
