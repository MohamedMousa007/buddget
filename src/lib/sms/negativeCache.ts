/**
 * Negative cache for the AI tier (docs/launch/S1-sms-audit.md RC-E): a message whose exact masked shape the AI has
 * already judged "not a transaction" is not sent to the AI again.
 *
 * Keyed on the exact masked body, not a coarse key: wrongly rejecting a real bank message loses money data, so two
 * messages must read the same word for word (numbers and names aside) before one verdict covers both. The shape must
 * also not have parsed as a transaction, for anyone, in the last 30 days.
 */
import type { ServiceClient } from '@/lib/supabase/service'
import { maskSkeletonText } from './skeleton'

/** The gold-set metrics replay the old rule (two rejections) with this count; the live rule is `isSettledNonTransaction`. */
export const MIN_AI_REJECTIONS = 2

/** Only a verdict this recent counts, for or against: a sender changes its wording and the model improves. */
export const NEGATIVE_WINDOW_DAYS = 30
const DAY_MS = 86_400_000
/** Evidence from one account on one day is one opinion; settled needs 2 accounts, or 3 messages over 2 days. */
const MIN_USERS = 2
const MIN_MESSAGES = 3
const MIN_DAYS = 2

/** `failure_code` of a row rejected from this cache. Distinct from the AI's own, so a cached verdict never counts as new evidence. */
export const KNOWN_NON_TRANSACTION = 'known_non_transaction'

export interface Rejection { user_id: string; created_at: string }

/** Whether the AI's recent rejections of one shape are broad enough to settle it, given a parsed row of it in the window (which always clears it). */
export function isSettledNonTransaction(rejections: Rejection[], parsedInWindow: boolean, now: number = Date.now()): boolean {
  if (parsedInWindow) return false
  const recent = rejections.filter((r) => now - Date.parse(r.created_at) <= NEGATIVE_WINDOW_DAYS * DAY_MS)
  if (new Set(recent.map((r) => r.user_id)).size >= MIN_USERS) return true
  const days = new Set(recent.map((r) => r.created_at.slice(0, 10)))
  return recent.length >= MIN_MESSAGES && days.size >= MIN_DAYS
}

/** Never throws and fails open: any doubt sends the message to the AI as before. */
export async function isKnownNonTransaction(service: ServiceClient, message: string): Promise<boolean> {
  const shape = maskSkeletonText(message)
  if (shape.length < 8) return false
  const since = new Date(Date.now() - NEGATIVE_WINDOW_DAYS * DAY_MS).toISOString()
  try {
    const [rejected, parsed] = await Promise.all([
      service
        .from('sms_parse_log')
        .select('user_id, created_at')
        .eq('masked_body', shape)
        .eq('status', 'rejected')
        .eq('failure_code', 'not_transaction')
        .in('parse_method', ['ai_new', 'ai'])
        .gte('created_at', since)
        .limit(50),
      service.from('sms_parse_log').select('id').eq('masked_body', shape).eq('parsed_ok', true).gte('created_at', since).limit(1),
    ])
    if (rejected.error || parsed.error) return false
    return isSettledNonTransaction(rejected.data ?? [], (parsed.data?.length ?? 0) > 0)
  } catch {
    return false
  }
}
