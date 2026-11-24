import 'server-only'
import type { ServiceClient } from '@/lib/supabase/service'

/** What a staff reply needs about its recipient: a first name for {{first_name}} and the language for the push. */
export async function supportRecipient(service: ServiceClient, userId: string): Promise<{ firstName: string | null; locale: string | null }> {
  const [profile, settings] = await Promise.all([
    service.from('profiles').select('display_name, name').eq('id', userId).maybeSingle(),
    service.from('user_settings').select('language').eq('user_id', userId).maybeSingle(),
  ])
  const p = profile.data as { display_name?: string | null; name?: string | null } | null
  const full = (p?.display_name || p?.name || '').trim()
  return {
    firstName: full && !full.includes('@') ? full.split(/\s+/)[0]!.slice(0, 40) : null,
    locale: ((settings.data as { language?: string | null } | null)?.language as string | null) ?? null,
  }
}
