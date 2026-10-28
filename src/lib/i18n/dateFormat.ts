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

/** Locale-aware, digit-safe time ("3:30 PM" / "3:30 م"). Follows the app language, not the device's. */
export function formatClock(date: Date, locale: AppLocale): string {
  return new Intl.DateTimeFormat(intlTag(locale), { hour: 'numeric', minute: '2-digit' }).format(date)
}
