'use client'

import { createContext, useContext, useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { en } from './dictionaries/en'
import { ar } from './dictionaries/ar'
import type { Dictionary, Locale } from './types'

const dictionaries: Record<Locale, Dictionary> = { en, ar }

interface LocaleContextValue {
  t: Dictionary
  locale: Locale
  dir: 'ltr' | 'rtl'
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue>({
  t: en,
  locale: 'en',
  dir: 'ltr',
  setLocale: () => {},
})

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const { language, updateSettings } = useFinanceStore(
    useShallow((s) => ({ language: s.settings.language, updateSettings: s.updateSettings })),
  )

  const locale: Locale = language === 'ar' ? 'ar' : 'en'
  const t = dictionaries[locale]

  const setLocale = useMemo(
    () => (next: Locale) => updateSettings({ language: next }),
    [updateSettings],
  )

  useEffect(() => {
    const html = document.documentElement
    /** Keep layout mirror-identical to English; Arabic is language + text alignment only. */
    html.setAttribute('dir', 'ltr')
    html.setAttribute('lang', locale === 'ar' ? 'ar' : 'en')
    html.setAttribute('data-locale', locale)
  }, [locale])

  const value = useMemo<LocaleContextValue>(
    () => ({ t, locale, dir: 'ltr', setLocale }),
    [t, locale, setLocale],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

/** Returns the full typed dictionary for the current locale. */
export function useT(): Dictionary {
  return useContext(LocaleContext).t
}

/** Returns locale metadata + setter for language switcher components. */
export function useLocale() {
  const { locale, dir, setLocale } = useContext(LocaleContext)
  return { locale, dir, setLocale } as const
}

/** Shorthand: current text direction. */
export function useDir(): 'ltr' | 'rtl' {
  return useContext(LocaleContext).dir
}

/**
 * For icon + label rows (sidebar, menus): Arabic labels align end without mirroring the whole UI.
 */
export function localeInlineLabelClass(locale: Locale): string {
  return locale === 'ar' ? 'flex-1 min-w-0 text-end' : 'min-w-0'
}

export type { Dictionary, Locale }
