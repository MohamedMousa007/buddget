/**
 * Resolve a user's preferred language server-side for localized push /
 * notification copy. Reads the normalized `user_settings.language` (synced from
 * the client, freshest), falling back to the legacy `user_finance.payload`, then
 * `'en'`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Locale } from '@/lib/i18n/types'

export async function getUserLocale(
  service: SupabaseClient,
  userId: string,
): Promise<Locale> {
  try {
    const { data } = await service
      .from('user_settings')
      .select('language')
      .eq('user_id', userId)
      .maybeSingle()
    if (data?.language === 'ar') return 'ar'
    if (data?.language === 'en') return 'en'

    const { data: legacy } = await service
      .from('user_finance')
      .select('payload')
      .eq('user_id', userId)
      .maybeSingle()
    const lang = (legacy?.payload as { settings?: { language?: string } } | null)?.settings?.language
    return lang === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}
