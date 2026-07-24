/**
 * In-memory cache of globally-trusted (`Curated DB`) templates.
 *
 * These apply to every user, so they are consulted on almost every parse. Caching them per warm
 * instance makes the tier match at code speed and removes the only runtime difference between it
 * and `Fully Curated` — which is what lets the DB stay the permanent home for auto-grown
 * patterns (where retirement is a flag flip) rather than pushing them into code to go fast.
 *
 * Mirrors the config cache in `promotionChecker.ts`. The TTL is short so a retirement or
 * quarantine takes effect promptly; a stale entry is bounded by the fact that a retired template
 * merely stops matching a minute later than it could have. Admin actions that change reach or
 * health should call `invalidateCuratedDbCache()` for immediate effect.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { TemplateCandidate } from '@/lib/sms/templateScope'

export const TEMPLATE_COLUMNS =
  'id, regex_pattern, mapping_rules, match_count, kind, tier, status, template_sample'

const TTL_MS = 60_000
let cache: { rows: TemplateCandidate[]; expiry: number } | null = null

export function invalidateCuratedDbCache(): void {
  cache = null
}

export async function getCuratedDbTemplates(service: SupabaseClient): Promise<TemplateCandidate[]> {
  if (cache && Date.now() < cache.expiry) return cache.rows
  const { data } = await service
    .from('sms_tracking_templates_ai')
    .select(TEMPLATE_COLUMNS)
    .eq('tier', 'curated_db')
    .eq('ai_enabled', true)
    .eq('status', 'active')
    .is('merged_into', null)
    .order('match_count', { ascending: false })
    .limit(200)
  const rows = (data ?? []) as unknown as TemplateCandidate[]
  cache = { rows, expiry: Date.now() + TTL_MS }
  return rows
}
