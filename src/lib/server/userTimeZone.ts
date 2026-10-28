import type { ServiceClient } from '@/lib/supabase/service'

export const DEFAULT_USER_TIME_ZONE = 'Africa/Cairo'

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** The user's reported IANA timezone, or the Cairo default for users whose device has not reported one yet. */
export async function getUserTimeZone(service: ServiceClient, userId: string): Promise<string> {
  const { data } = await service.from('user_settings').select('timezone').eq('user_id', userId).maybeSingle()
  return data?.timezone && isValidTimeZone(data.timezone) ? data.timezone : DEFAULT_USER_TIME_ZONE
}
