import { deviceTimeZone } from '@/lib/time/deviceTimeZone'

/** JS weekday index of the first day of the week: Sunday 0, Monday 1, Saturday 6. */
export type WeekStartDay = 0 | 1 | 6

export const WEEK_START_OPTIONS: readonly WeekStartDay[] = [6, 0, 1]

/** Egypt and the Gulf, where the week opens on Saturday. Keep in step with supabase/migrations/0217_b9_week_start.sql. */
const SATURDAY_FIRST_ZONES: ReadonlySet<string> = new Set([
  'Africa/Cairo',
  'Asia/Riyadh',
  'Asia/Dubai',
  'Asia/Muscat',
  'Asia/Kuwait',
  'Asia/Qatar',
  'Asia/Bahrain',
  'Asia/Aden',
])

/** Saturday for Egypt/Gulf zones, Sunday otherwise. */
export function defaultWeekStart(timeZone: string | null | undefined): WeekStartDay {
  return timeZone && SATURDAY_FIRST_ZONES.has(timeZone) ? 6 : 0
}

/** The user's choice, else the default for their zone (stored zone, then the device's). */
export function resolveWeekStart(settings: { weekStartDay?: WeekStartDay | null; timezone?: string | null }): WeekStartDay {
  return settings.weekStartDay ?? defaultWeekStart(settings.timezone ?? deviceTimeZone())
}

/** Column index (0 = first column) of a JS weekday in a grid that opens on `weekStart`. */
export function weekColumn(jsDay: number, weekStart: WeekStartDay): number {
  return (jsDay - weekStart + 7) % 7
}
