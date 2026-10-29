import { parseISO } from 'date-fns'
import { formatLocalized, type AppLocale } from '@/lib/i18n/dateFormat'

/** `yyyy-MM-dd` → "Sep 22" (en) / "22 سبتمبر"-style Arabic month name (ar), Latin digits. */
export function shortDate(iso: string, locale: AppLocale = 'en'): string {
  return formatLocalized(parseISO(iso.slice(0, 10)), 'MMM d', locale)
}
