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

/** A stored IANA timezone when usable, else the Cairo default: the one fallback every server path shares for users whose device has not reported a zone. */
export function resolveUserTimeZone(stored: string | null | undefined): string {
  return stored && isValidTimeZone(stored) ? stored : DEFAULT_USER_TIME_ZONE
}

/** The user's reported IANA timezone, or the Cairo default for users whose device has not reported one yet. */
export async function getUserTimeZone(service: ServiceClient, userId: string): Promise<string> {
  const { data } = await service.from('user_settings').select('timezone').eq('user_id', userId).maybeSingle()
  return resolveUserTimeZone(data?.timezone)
}
