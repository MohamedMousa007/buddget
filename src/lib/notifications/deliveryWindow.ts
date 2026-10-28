import { DEFAULT_USER_TIME_ZONE, isValidTimeZone } from '@/lib/server/userTimeZone'

export const DELIVERY_START_HOUR = 9
export const DELIVERY_END_HOUR = 21

/** The user's IANA zone, or Cairo when none has been reported (user_settings.timezone is NULL until a device reports it). */
export function resolveUserTimeZone(tz: string | null | undefined): string {
  return tz && isValidTimeZone(tz) ? tz : DEFAULT_USER_TIME_ZONE
}

/**
 * True from 09:00 to 20:59 in the user's own zone. Hourly runs reach each user at their 09:00; a daily run reaches
 * everyone already past 09:00 and skips night hours. Safe to repeat: every alert is deduped by key.
 */
export function isDeliveryWindow(utcNow: Date, timeZone: string): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(utcNow))
  return hour >= DELIVERY_START_HOUR && hour < DELIVERY_END_HOUR
}
