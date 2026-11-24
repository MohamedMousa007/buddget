import { formatClock, type AppLocale } from '@/lib/i18n/dateFormat'
import { safeLocalDayKey } from '@/lib/utils/localDate'

/**
 * Time of day of a transaction, for detail views, or null when there is no real time to show. Shown only when
 * `occurredAt` exists and falls on the row's own local day (an SMS dated from its text can carry a capture time from
 * another day), and never for exactly local 12:00:00.000: that is the stand-in a re-dated or back-filled row is given,
 * the same instant every reader assumes when there is no time.
 */
export function transactionTime(occurredAt: string | null | undefined, day: string, locale: AppLocale): string | null {
  if (!occurredAt) return null
  if (safeLocalDayKey(occurredAt) !== day.slice(0, 10)) return null
  const at = new Date(occurredAt)
  if (at.getHours() === 12 && at.getMinutes() === 0 && at.getSeconds() === 0 && at.getMilliseconds() === 0) return null
  return formatClock(at, locale)
}
