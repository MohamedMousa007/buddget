import type { ServiceClient } from '@/lib/supabase/service'
import { materializeShape, type ReplayCase } from '@/lib/sms/replayHarness'
import { REJECTED_TX_LIKE_KIND } from '@/lib/sms/statsOutbox'

const MAX_CASES = 100

/**
 * Known shapes for one sender, from the masked corpus: shapes a parser handled (must keep matching their
 * kind/currency) and shapes the pre-filter rejected as transaction-like (no template may match them).
 * Bounded and defensive: any failure yields no cases, which only means the replay check is skipped.
 */
export async function loadReplayCases(service: ServiceClient, sender: string): Promise<ReplayCase[]> {
  try {
    const { data } = await service
      .from('sms_corpus')
      .select('skeleton_key, redacted_body, kind, currency, ok_count')
      .eq('sender_key', sender)
      .order('seen_count', { ascending: false })
      .limit(MAX_CASES)
    return (data ?? []).flatMap((r): ReplayCase[] => {
      if (!r.redacted_body) return []
      const body = materializeShape(r.redacted_body)
      if (r.kind === REJECTED_TX_LIKE_KIND) return [{ id: r.skeleton_key, body, expect: { matches: false } }]
      if (r.ok_count > 0 && r.kind) {
        return [{ id: r.skeleton_key, body, expect: { matches: true, kind: r.kind, ...(r.currency ? { currency: r.currency } : {}) } }]
      }
      return []
    })
  } catch {
    return []
  }
}
