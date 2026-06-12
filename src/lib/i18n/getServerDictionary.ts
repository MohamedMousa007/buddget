/**
 * Server-side dictionary access (no React). Lets API routes / cron build
 * localized push + notification copy from the same `en`/`ar` dictionaries the
 * client uses, keyed by the user's stored language.
 */
import { en } from '@/lib/i18n/dictionaries/en'
import { ar } from '@/lib/i18n/dictionaries/ar'
import type { Dictionary, Locale } from '@/lib/i18n/types'

export function getServerDictionary(locale: Locale | string | null | undefined): Dictionary {
  return locale === 'ar' ? ar : en
}
