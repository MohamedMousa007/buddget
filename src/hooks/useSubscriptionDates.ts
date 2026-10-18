'use client'

import { format, parseISO } from 'date-fns'
import { arEG } from 'date-fns/locale/ar-EG'
import { enUS } from 'date-fns/locale/en-US'
import { useMemo } from 'react'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { useLocale } from '@/lib/i18n'
import { toLatinDigits } from '@/lib/utils/formatters'

/**
 * Dates the way the Subscriptions design writes them: "19 Oct" in English, "19 أكتوبر" in
 * Arabic (the full month, not the clipped abbreviation), digits always Latin.
 */
export function useSubscriptionDates() {
  const { locale } = useLocale()
  const { formatDayMonth } = useLocalizedFormatters()
  return useMemo(() => {
    const ar = locale === 'ar'
    const loc = ar ? arEG : enUS
    return {
      /** `yyyy-MM-dd` → "19 Oct" */
      shortDate: (iso: string) => formatDayMonth(iso.slice(0, 10)),
      /** `yyyy-MM-dd` → "Mar 2026" */
      monthYear: (iso: string) => toLatinDigits(format(parseISO(iso.slice(0, 10)), ar ? 'MMMM yyyy' : 'MMM yyyy', { locale: loc })),
      /** `yyyy-MM` → "October 2026" */
      periodLabel: (yyyyMm: string) => toLatinDigits(format(parseISO(`${yyyyMm}-01`), 'MMMM yyyy', { locale: loc })),
    }
  }, [locale, formatDayMonth])
}
