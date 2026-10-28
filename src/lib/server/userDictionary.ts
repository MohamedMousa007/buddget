import type { SupabaseClient } from '@supabase/supabase-js'
import { getServerDictionary } from '@/lib/i18n/getServerDictionary'
import type { Dictionary } from '@/lib/i18n/types'

/** The dictionary for a user's stored language; English when unset or unreadable. */
export async function getUserDictionary(service: SupabaseClient, userId: string): Promise<Dictionary> {
  const { data } = await service.from('user_settings').select('language').eq('user_id', userId).maybeSingle()
  return getServerDictionary(data?.language as string | null | undefined)
}
