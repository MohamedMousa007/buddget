import { format, type Locale } from 'date-fns'
import { arEG } from 'date-fns/locale/ar-EG'
import { enUS } from 'date-fns/locale/en-US'
import { toLatinDigits } from '@/lib/utils/formatters'

export type AppLocale = 'en' | 'ar'

/** BCP-47 tag for Intl: Arabic names, always Latin digits. */
export function intlTag(locale: string): string {
  return locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US'
}

export function dfLocale(locale: AppLocale): Locale {
  return locale === 'ar' ? arEG : enUS
}

/**
 * The one date-fns entry point for user-facing text. Month and weekday names follow the app
 * language; Arabic gets the full month name (the abbreviation is clipped to "أكتـ") and Latin digits.
 */
export function formatLocalized(date: Date, pattern: string, locale: AppLocale): string {
  if (Number.isNaN(date.getTime())) return ''
  const p = locale === 'ar' ? pattern.replace(/(?<![M])MMM(?!M)/g, 'MMMM') : pattern
  const out = format(date, p, { locale: dfLocale(locale) })
  return locale === 'ar' ? toLatinDigits(out) : out
}

/** Month names January..December in the app language (index 0 = January). */
export function monthNames(locale: AppLocale, width: 'long' | 'short' = 'long'): string[] {
  const fmt = new Intl.DateTimeFormat(intlTag(locale), { month: locale === 'ar' ? 'long' : width, timeZone: 'UTC' })
  return Array.from({ length: 12 }, (_, m) => fmt.format(new Date(Date.UTC(2024, m, 15))))
}

/** Weekday names indexed by JS weekday (0 = Sunday). */
export function weekdayNames(locale: AppLocale, width: 'long' | 'short' | 'narrow' = 'long'): string[] {
  const fmt = new Intl.DateTimeFormat(intlTag(locale), { weekday: width, timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, d) => fmt.format(new Date(Date.UTC(2024, 0, 7 + d))))
}

let deviceH12: boolean | undefined
/** Whether the device's own locale writes a 12-hour clock (en-US: yes; en-GB, de, most of the world: no). */
export function deviceUses12Hour(): boolean {
  if (deviceH12 === undefined) {
    try {
      deviceH12 = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? true
    } catch {
      deviceH12 = true
    }
  }
  return deviceH12
}

/**
 * Compact, digit-safe time of day, never with seconds: "3:30 PM" on a 12-hour device, "15:30" on a 24-hour one.
 * Names (AM/PM, ص/م) follow the app language; the 12/24-hour choice follows the device locale.
 */
export function formatClock(date: Date, locale: AppLocale, hour12: boolean = deviceUses12Hour()): string {
  return new Intl.DateTimeFormat(intlTag(locale), hour12 ? { hour: 'numeric', minute: '2-digit', hour12: true } : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}
