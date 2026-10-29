'use client'

import { useCallback } from 'react'
import { useLocale } from '@/lib/i18n'
import { shortDate } from '@/lib/utils/shortDate'

/** `shortDate` bound to the app language. */
export function useShortDate(): (iso: string) => string {
  const { locale } = useLocale()
  return useCallback((iso: string) => shortDate(iso, locale), [locale])
}
