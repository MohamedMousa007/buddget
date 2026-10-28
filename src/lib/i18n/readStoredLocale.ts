import type { Locale } from './types'

/** Locale for surfaces rendered outside LocaleProvider (root error page): the persisted store, else English. */
export function readStoredLocale(): Locale {
  try {
    const raw = window.localStorage.getItem('buddget-storage')
    const language = raw ? (JSON.parse(raw) as { state?: { settings?: { language?: string } } }).state?.settings?.language : null
    return language === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}
