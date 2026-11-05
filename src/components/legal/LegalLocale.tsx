'use client'

import type { ReactNode } from 'react'
import { useLocale } from '@/lib/i18n'

/** A whole legal document in the user's language; the Arabic one is laid out right-to-left. */
export function LegalLocale({ en, ar }: { en: ReactNode; ar: ReactNode }) {
  const { locale } = useLocale()
  return locale === 'ar' ? <div lang="ar" dir="rtl" className="space-y-10">{ar}</div> : <>{en}</>
}

/** A short label (nav link, footer line) in the user's language, with no wrapper element. */
export function LegalLabel({ en, ar }: { en: string; ar: string }) {
  return <>{useLocale().locale === 'ar' ? ar : en}</>
}
