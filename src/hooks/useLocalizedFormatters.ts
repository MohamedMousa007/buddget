'use client'

import { useMemo } from 'react'
import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns'
import { arEG } from 'date-fns/locale/ar-EG'
import { enUS } from 'date-fns/locale/en-US'
import { useLocale, useT } from '@/lib/i18n'

/**
 * Date/time helpers that follow the active app locale (EN / AR) for copy and month names.
 * Amounts stay Western-numeral via `formatCurrency` in `@/lib/utils/formatters`.
 */
export function useLocalizedFormatters() {
  const { locale } = useLocale()
  const t = useT()
  const dfLocale = locale === 'ar' ? arEG : enUS

  return useMemo(
    () => ({
      formatDate(dateStr: string) {
        const date = parseISO(dateStr)
        if (isToday(date)) return t.common.today
        if (isYesterday(date)) return t.common.yesterday
        return format(date, 'd MMM yyyy', { locale: dfLocale })
      },
      formatDateShort(dateStr: string) {
        return format(parseISO(dateStr), 'd MMM', { locale: dfLocale })
      },
      groupByDate(dateStr: string) {
        const date = parseISO(dateStr)
        if (isToday(date)) return t.common.today
        if (isYesterday(date)) return t.common.yesterday
        return format(date, 'EEEE, d MMMM', { locale: dfLocale })
      },
      formatMonth(yyyyMm: string) {
        return format(parseISO(`${yyyyMm}-01`), 'MMMM yyyy', { locale: dfLocale })
      },
      formatMonthShort(yyyyMm: string) {
        return format(parseISO(`${yyyyMm}-01`), 'MMM yyyy', { locale: dfLocale })
      },
      formatRelativeTime(dateStr: string) {
        return formatDistanceToNow(parseISO(dateStr), { addSuffix: true, locale: dfLocale })
      },
      /** Short month name for calendar grid buttons (Jan / يناير, …). */
      monthButtonLabel(month1to12: number) {
        return format(new Date(2024, month1to12 - 1, 1), 'MMM', { locale: dfLocale })
      },
    }),
    [dfLocale, t],
  )
}
