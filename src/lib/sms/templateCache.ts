import type { createServiceRoleClient } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof createServiceRoleClient>

export interface CachedTemplate {
  id: string
  regex_pattern: string
  mapping_rules: Record<string, unknown>
  match_count: number
  kind: string | null
  tier: 'learned' | 'promoted'
}

interface CacheEntry {
  templates: CachedTemplate[]
  expiry: number
}

const PROMOTED_TTL_MS = 10 * 60 * 1000 // 10 min — promoted templates change rarely
const LEARNED_TTL_MS  =  5 * 60 * 1000 // 5 min  — new templates added more frequently

const promotedCache = new Map<string, CacheEntry>()
const learnedCache  = new Map<string, CacheEntry>()

export async function getPromotedTemplates(
  sender: string,
  service: ServiceClient,
): Promise<CachedTemplate[]> {
  const entry = promotedCache.get(sender)
  if (entry && Date.now() < entry.expiry) return entry.templates

  const { data } = await service
    .from('sms_tracking_templates_ai')
    .select('id, regex_pattern, mapping_rules, match_count, kind, tier')
    .eq('sender', sender)
    .eq('ai_enabled', true)
    .eq('tier', 'promoted')
    .order('match_count', { ascending: false })

  const templates = (data ?? []) as CachedTemplate[]
  promotedCache.set(sender, { templates, expiry: Date.now() + PROMOTED_TTL_MS })
  return templates
}

export async function getLearnedTemplates(
  sender: string,
  service: ServiceClient,
): Promise<CachedTemplate[]> {
  const entry = learnedCache.get(sender)
  if (entry && Date.now() < entry.expiry) return entry.templates

  const { data } = await service
    .from('sms_tracking_templates_ai')
    .select('id, regex_pattern, mapping_rules, match_count, kind, tier')
    .eq('sender', sender)
    .eq('ai_enabled', true)
    .eq('tier', 'learned')
    .order('match_count', { ascending: false })
    .limit(10)

  const templates = (data ?? []) as CachedTemplate[]
  learnedCache.set(sender, { templates, expiry: Date.now() + LEARNED_TTL_MS })
  return templates
}

export function invalidateSenderCache(sender: string): void {
  promotedCache.delete(sender)
  learnedCache.delete(sender)
}

export function invalidateAllCache(): void {
  promotedCache.clear()
  learnedCache.clear()
}
