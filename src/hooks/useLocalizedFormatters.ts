'use client'

import { useMemo } from 'react'
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns'
import { arEG } from 'date-fns/locale/ar-EG'
import { enUS } from 'date-fns/locale/en-US'
import { useLocale, useT } from '@/lib/i18n'
import { toLatinDigits } from '@/lib/utils/formatters'

/**
 * Date/time helpers that follow the active app locale (EN / AR) for month and weekday names.
 * Digits are always rendered as Western 0-9 — see `toLatinDigits`.
 */
export function useLocalizedFormatters() {
  const { locale } = useLocale()
  const t = useT()
  const dfLocale = locale === 'ar' ? arEG : enUS

  return useMemo(() => {
    const digits = locale === 'ar' ? toLatinDigits : (s: string) => s
    return {
      formatDate(dateStr: string) {
        const date = parseISO(dateStr)
        if (isToday(date)) return t.common.today
        if (isYesterday(date)) return t.common.yesterday
        return digits(format(date, 'd MMM yyyy', { locale: dfLocale }))
      },
      formatDateShort(dateStr: string) {
        return digits(format(parseISO(dateStr), 'd MMM', { locale: dfLocale }))
      },
      groupByDate(dateStr: string) {
        const date = parseISO(dateStr)
        if (isToday(date)) return t.common.today
        if (isYesterday(date)) return t.common.yesterday
        return digits(format(date, 'EEEE, d MMMM', { locale: dfLocale }))
      },
      formatMonth(yyyyMm: string) {
        return digits(format(parseISO(`${yyyyMm}-01`), 'MMMM yyyy', { locale: dfLocale }))
      },
      formatMonthShort(yyyyMm: string) {
        return digits(format(parseISO(`${yyyyMm}-01`), 'MMM yyyy', { locale: dfLocale }))
      },
      formatRelativeTime(dateStr: string) {
        return digits(formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: dfLocale }))
      },
      /** Short month name for calendar grid buttons (Jan / يناير, …). */
      monthButtonLabel(month1to12: number) {
        return digits(format(new Date(2024, month1to12 - 1, 1), 'MMM', { locale: dfLocale }))
      },
      /** Abbreviated weekday: WED / الأربعاء */
      formatDayAbbr(dateStr: string) {
        return format(parseISO(dateStr), 'EEE', { locale: dfLocale }).toUpperCase()
      },
      /** Time respecting device 12/24h preference via Intl. */
      formatTime(isoStr: string) {
        return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(isoStr))
      },
    }
  }, [dfLocale, t, locale])
}
