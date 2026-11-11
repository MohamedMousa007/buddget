import type { Locale } from '@/lib/i18n/types'

/** The chosen language, mirrored to a cookie so the server can emit `<html lang>` on first paint (the setting itself lives in local storage). */
export const LOCALE_COOKIE = 'bdg-lang'

export const parseLocaleCookie = (value: string | undefined): Locale => (value === 'ar' ? 'ar' : 'en')

export function writeLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`
}
