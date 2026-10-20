/**
 * Resolve a user's preferred language server-side for localized push / notification copy:
 * the normalized `user_settings.language` (synced from the client), `'en'` when absent.
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
    return data?.language === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}
