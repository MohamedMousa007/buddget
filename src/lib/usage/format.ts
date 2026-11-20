import { intlTag } from '@/lib/i18n/dateFormat'
import type { NoticeData } from '@/lib/i18n/usageCopy'

/** Clock time, weekday and short date for a reset, in the app language with Latin digits. Never a countdown. */
export function clock(iso: string | null, locale: string): string {
  return iso ? new Date(iso).toLocaleTimeString(intlTag(locale), { hour: '2-digit', minute: '2-digit', hour12: false }) : ''
}
export function weekday(iso: string | null, locale: string): string {
  return iso ? new Date(iso).toLocaleDateString(intlTag(locale), { weekday: 'long' }) : ''
}
export function shortDate(iso: string | null, locale: string): string {
  return iso ? new Date(iso).toLocaleDateString(intlTag(locale), { day: 'numeric', month: 'short' }) : ''
}
/** "Sat 21 Nov": the week reset line under a meter. */
export function weekdayDate(iso: string | null, locale: string): string {
  return iso ? new Date(iso).toLocaleDateString(intlTag(locale), { weekday: 'short', day: 'numeric', month: 'short' }) : ''
}

/**
 * When a limit is back (BDG-012): a clock time when it is later today, otherwise the day, date and time ("Sat 21 Nov, 14:30").
 * In the phone's own time zone, which is the reader's.
 */
export function resetLabel(iso: string | null, locale: string, now = Date.now()): string {
  if (!iso || Number.isNaN(Date.parse(iso))) return ''
  const sameDay = new Date(iso).toDateString() === new Date(now).toDateString()
  return sameDay ? clock(iso, locale) : `${weekdayDate(iso, locale)}, ${clock(iso, locale)}`
}

export function noticeData(over: Partial<NoticeData> & { sessionResetAt?: string | null; weekResetAt?: string | null; dateAt?: string | null }, locale: string): NoticeData {
  return {
    time: over.time ?? clock(over.sessionResetAt ?? null, locale),
    day: over.day ?? weekday(over.weekResetAt ?? null, locale),
    date: over.date ?? shortDate(over.dateAt ?? null, locale),
    n: over.n ?? 0,
    sparks: over.sparks ?? 0,
  }
}
