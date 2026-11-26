import type { SupabaseClient } from '@supabase/supabase-js'

/** Per-account ceilings so repeated registration or rotation cannot grow a table without bound (QA6 SST-11). */
export const MAX_PUSH_TOKENS = 20
export const MAX_RETIRED_INGEST_TOKENS = 5
export const MAX_ACTIVE_INGEST_TOKENS = 3
export const ROTATIONS_PER_HOUR = 10
/** Every token fetch issues a token (only hashes are stored), and the app fetches on start and when the SMS settings open. */
export const ISSUES_PER_HOUR = 60

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

/**
 * A phone that mints several tokens at once (start-up, sign-in and the settings arm racing) saves whichever response lands
 * last, which need not be the newest. Tokens this young are never retired, so the one it kept still works.
 */
export const INGEST_TOKEN_GRACE_MS = 10 * 60_000

/** Deactivates (never deletes) the oldest active tokens of one device scope past the newest MAX_ACTIVE_INGEST_TOKENS, sparing any inside the grace window. */
export async function capActiveIngestTokens(service: SupabaseClient, userId: string, deviceId: string | null, now = Date.now()) {
  let q = service.from('sms_ingest_tokens').select('id, created_at').eq('user_id', userId).eq('is_active', true)
  q = deviceId ? q.eq('device_id', deviceId) : q.is('device_id', null)
  const { data } = await q.order('created_at', { ascending: false }).range(MAX_ACTIVE_INGEST_TOKENS, MAX_ACTIVE_INGEST_TOKENS + SWEEP - 1)
  const ids = (data ?? []).filter((r) => Date.parse(r.created_at as string) < now - INGEST_TOKEN_GRACE_MS).map((r) => r.id as string)
  if (ids.length > 0) await service.from('sms_ingest_tokens').update({ is_active: false }).in('id', ids)
}
