import type { SupabaseClient } from '@supabase/supabase-js'

const ATTEMPT_KEY = 'prices_refresh_attempt'

/**
 * Atomically takes the right to run a refresh: one conditional UPDATE ... RETURNING that only matches when the last
 * attempt is older than `debounceMs`, so concurrent callers cannot both win. A first-ever attempt is claimed by an
 * insert that ignores a duplicate. Any database error counts as lost, so a failing DB never opens the provider crawl.
 */
export async function claimPriceRefresh(service: SupabaseClient, nowMs: number, debounceMs: number): Promise<boolean> {
  const at = new Date(nowMs).toISOString()
  const { data: updated, error } = await service
    .from('platform_settings')
    .update({ value: { at } })
    .eq('key', ATTEMPT_KEY)
    .lt('value->>at', new Date(nowMs - debounceMs).toISOString())
    .select('key')
  if (error) return false
  if (updated && updated.length > 0) return true
  const { data: inserted, error: insertError } = await service
    .from('platform_settings')
    .upsert({ key: ATTEMPT_KEY, value: { at } }, { onConflict: 'key', ignoreDuplicates: true })
    .select('key')
  return !insertError && (inserted?.length ?? 0) > 0
}
