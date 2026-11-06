'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useLocale } from '@/lib/i18n'
import type { SiteLocale } from '@/lib/site/config'

/** Set by routes whose URL names a language (`/ar/legal/*`); absent everywhere else. */
const ForcedLegalLocale = createContext<SiteLocale | null>(null)

export function LegalLocaleProvider({ locale, children }: { locale: SiteLocale; children: ReactNode }) {
  return <ForcedLegalLocale.Provider value={locale}>{children}</ForcedLegalLocale.Provider>
}

/** The language of the legal text: the one in the URL when there is one, otherwise the app language setting. */
export function useLegalLocale(): SiteLocale {
  const forced = useContext(ForcedLegalLocale)
  const app = useLocale().locale
  return forced ?? app
}

/** True when the URL, not the app setting, chose the language. */
export function useLegalLocaleIsExplicit(): boolean {
  return useContext(ForcedLegalLocale) !== null
}

/** A whole legal document in the reader's language; the Arabic one is laid out right-to-left. */
export function LegalLocale({ en, ar }: { en: ReactNode; ar: ReactNode }) {
  return useLegalLocale() === 'ar' ? <div lang="ar" dir="rtl" className="space-y-10">{ar}</div> : <>{en}</>
}

/** A short label (nav link, footer line) in the reader's language, with no wrapper element. */
export function LegalLabel({ en, ar }: { en: string; ar: string }) {
  return <>{useLegalLocale() === 'ar' ? ar : en}</>
}
