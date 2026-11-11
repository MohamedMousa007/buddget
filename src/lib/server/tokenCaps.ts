import type { SupabaseClient } from '@supabase/supabase-js'

/** Per-account ceilings so repeated registration or rotation cannot grow a table without bound (QA6 SST-11). */
export const MAX_PUSH_TOKENS = 20
export const MAX_RETIRED_INGEST_TOKENS = 5
export const ROTATIONS_PER_HOUR = 10

const SWEEP = 500

/** Deletes everything past the newest `keep` rows of one user's rows in `table`. */
async function trimToNewest(service: SupabaseClient, table: 'push_tokens' | 'sms_ingest_tokens', userId: string, orderBy: string, keep: number, extra?: { column: string; value: boolean }) {
  let q = service.from(table).select('id').eq('user_id', userId)
  if (extra) q = q.eq(extra.column, extra.value)
  const { data } = await q.order(orderBy, { ascending: false }).range(keep, keep + SWEEP - 1)
  const ids = (data ?? []).map((r) => r.id as string)
  if (ids.length > 0) await service.from(table).delete().in('id', ids)
}

export const trimPushTokens = (service: SupabaseClient, userId: string) => trimToNewest(service, 'push_tokens', userId, 'updated_at', MAX_PUSH_TOKENS)

/** Retired (inactive) ingest tokens are history, not credentials: keep a few, drop the rest. */
export const trimRetiredIngestTokens = (service: SupabaseClient, userId: string) =>
  trimToNewest(service, 'sms_ingest_tokens', userId, 'created_at', MAX_RETIRED_INGEST_TOKENS, { column: 'is_active', value: false })
