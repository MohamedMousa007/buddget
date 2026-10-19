import type { ServiceClient } from '@/lib/supabase/service'
import type { EmailLocale } from '@/lib/email/scenarios'
import type { RenderableTemplate } from '@/lib/email/render'

const TTL_MS = 30_000

interface Entry { at: number; template: RenderableTemplate | null }
const cache = new Map<string, Entry>()

/** Called on publish so this instance serves the new version at once; other instances catch up within the TTL. */
export function invalidateTemplate(key: string): void {
  for (const k of cache.keys()) if (k.startsWith(`${key}:`)) cache.delete(k)
}

export async function loadPublished(service: ServiceClient, key: string, locale: EmailLocale, now = Date.now()): Promise<RenderableTemplate | null> {
  const ck = `${key}:${locale}`
  const hit = cache.get(ck)
  if (hit && now - hit.at < TTL_MS) return hit.template
  const { data, error } = await service
    .from('email_templates')
    .select('subject, preheader, html')
    .eq('key', key)
    .eq('locale', locale)
    .eq('status', 'published')
    .maybeSingle()
  if (error) {
    console.error('[email/store] load failed', error.message)
    return null
  }
  cache.set(ck, { at: now, template: data })
  return data
}

export async function resolveUserLocale(service: ServiceClient, userId: string | null | undefined): Promise<unknown> {
  if (!userId) return undefined
  const { data } = await service.from('user_settings').select('language').eq('user_id', userId).maybeSingle()
  return data?.language
}
