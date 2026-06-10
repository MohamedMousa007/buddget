import type { createServiceRoleClient } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof createServiceRoleClient>

export interface CachedTemplate {
  id: string
  regex_pattern: string
  mapping_rules: Record<string, unknown>
  match_count: number
  kind: string | null
}

interface CacheEntry {
  templates: CachedTemplate[]
  expiry: number
}

const TEMPLATE_TTL_MS = 10 * 60 * 1000 // 10 min

const templateCache = new Map<string, CacheEntry>()

export async function getTemplates(
  sender: string,
  service: ServiceClient,
): Promise<CachedTemplate[]> {
  const entry = templateCache.get(sender)
  if (entry && Date.now() < entry.expiry) return entry.templates

  const { data } = await service
    .from('sms_tracking_templates_ai')
    .select('id, regex_pattern, mapping_rules, match_count, kind')
    .eq('sender', sender)
    .eq('ai_enabled', true)
    .order('match_count', { ascending: false })
    .limit(10)

  const templates = (data ?? []) as CachedTemplate[]
  templateCache.set(sender, { templates, expiry: Date.now() + TEMPLATE_TTL_MS })
  return templates
}

export function invalidateSenderCache(sender: string): void {
  templateCache.delete(sender)
}

export function invalidateAllCache(): void {
  templateCache.clear()
}
