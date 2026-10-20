import type { ServiceClient } from '@/lib/supabase/service'
import { effectiveSender } from '@/lib/sms/routingKey'
import { smsSkeleton } from '@/lib/sms/skeleton'

const BATCH = 500

/**
 * Moves what raw SMS text teaches into the redacted corpus (via the statistics outbox) for rows that predate the
 * ingest-time harvest, then marks them harvested. Raw text is only removed (after 30 days) from harvested rows,
 * so nothing is lost. Pools and counters were already counted when these rows arrived, so only the corpus is fed.
 * Safe to run repeatedly; each call handles one batch.
 */
export async function harvestLegacySms(service: ServiceClient, limit = BATCH): Promise<number> {
  const { data: rows, error } = await service
    .from('sms_parse_log')
    .select('id, sender, raw_body, bank_name, status, parsed_ok, kind, parse_method, currency')
    .is('harvested_at', null)
    .not('raw_body', 'is', null)
    .neq('status', 'processing')
    .order('received_at', { ascending: true })
    .limit(limit)
  if (error || !rows?.length) return 0

  const outbox = rows.flatMap((r) => {
    const sk = smsSkeleton(r.raw_body ?? '', effectiveSender(r.sender, r.raw_body ?? '', r.bank_name))
    return sk
      ? [{
          sender: null,
          is_txn: false,
          user_id: null,
          skeleton_key: sk.key,
          sender_key: effectiveSender(r.sender, r.raw_body ?? '', r.bank_name),
          redacted_body: sk.redacted,
          kind: r.kind,
          parse_method: r.parse_method,
          currency: r.currency,
          parsed_ok: r.parsed_ok,
        }]
      : []
  })
  if (outbox.length) {
    const { error: insertError } = await service.from('sms_stats_outbox').insert(outbox)
    if (insertError) {
      console.warn('[sms/harvest] outbox insert failed', insertError.message)
      return 0
    }
  }
  const { error: markError } = await service.from('sms_parse_log').update({ harvested_at: new Date().toISOString() }).in('id', rows.map((r) => r.id))
  if (markError) console.warn('[sms/harvest] mark failed', markError.message)
  return rows.length
}
