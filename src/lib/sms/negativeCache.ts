/**
 * Negative cache for the AI tier (docs/launch/S1-sms-audit.md RC-E): a message whose exact masked shape the AI has
 * already judged "not a transaction" is not sent to the AI again.
 *
 * Keyed on the exact masked body, not a coarse key: wrongly rejecting a real bank message loses money data, so two
 * messages must read the same word for word (numbers and names aside) before one verdict covers both. The shape must
 * also never have parsed as a transaction, for anyone.
 */
import type { ServiceClient } from '@/lib/supabase/service'
import { maskSkeletonText } from './skeleton'

/** One rejection can be a slip of the model; the same verdict twice is treated as settled. */
export const MIN_AI_REJECTIONS = 2

/** `failure_code` of a row rejected from this cache. Distinct from the AI's own, so a cached verdict never counts as new evidence. */
export const KNOWN_NON_TRANSACTION = 'known_non_transaction'

/** Never throws and fails open: any doubt sends the message to the AI as before. */
export async function isKnownNonTransaction(service: ServiceClient, message: string): Promise<boolean> {
  const shape = maskSkeletonText(message)
  if (shape.length < 8) return false
  try {
    const [rejected, parsed] = await Promise.all([
      service
        .from('sms_parse_log')
        .select('id')
        .eq('masked_body', shape)
        .eq('status', 'rejected')
        .eq('failure_code', 'not_transaction')
        .in('parse_method', ['ai_new', 'ai'])
        .limit(MIN_AI_REJECTIONS),
      service.from('sms_parse_log').select('id').eq('masked_body', shape).eq('parsed_ok', true).limit(1),
    ])
    if (rejected.error || parsed.error) return false
    return (rejected.data?.length ?? 0) >= MIN_AI_REJECTIONS && (parsed.data?.length ?? 0) === 0
  } catch {
    return false
  }
}
