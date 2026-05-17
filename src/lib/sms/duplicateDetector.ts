/**
 * Duplicate SMS detection.
 *
 * Banks sometimes deliver the same SMS twice (from two shortcodes or via carrier retry).
 * We flag an event as duplicate if an existing `sms_events` row matches on:
 *   - same user
 *   - same amount + bank_name + transaction_type
 *   - received_at within ±60 seconds
 *
 * Incoming transfers (transfer_in, instapay_in, wallet_in) are always recorded
 * because they're informational and the user may want to see both legs.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ParsedTransaction } from '@/lib/sms/smsParser'

const WINDOW_SECONDS = 60

/** Types that should never be flagged as duplicate (always record). */
const ALWAYS_RECORD_TYPES = new Set(['transfer_in', 'instapay_in', 'wallet_in', 'refund'])

/**
 * Check whether a parsed SMS matches an existing `sms_events` row within the
 * dedup window. Uses the service-role client (no RLS required on server).
 */
export async function isDuplicate(
  userId: string,
  parsed: ParsedTransaction,
  supabase: SupabaseClient,
): Promise<boolean> {
  if (ALWAYS_RECORD_TYPES.has(parsed.type)) return false

  const windowStart = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString()
  const windowEnd = new Date(Date.now() + WINDOW_SECONDS * 1000).toISOString()

  const { data, error } = await supabase
    .from('sms_events')
    .select('id')
    .eq('user_id', userId)
    .eq('amount', parsed.amount)
    .eq('bank_name', parsed.bankName)
    .eq('transaction_type', parsed.type)
    .eq('parse_ok', true)
    .eq('is_duplicate', false)
    .gte('received_at', windowStart)
    .lte('received_at', windowEnd)
    .limit(1)

  if (error) {
    // On DB error, let the event through (better to double-record than miss one).
    console.error('[sms/dedup] query error', error.message)
    return false
  }

  return (data?.length ?? 0) > 0
}
