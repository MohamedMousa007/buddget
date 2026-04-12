'use client'

import { useLocale, useT } from '@/lib/i18n'
import { Globe, MoonStar } from 'lucide-react'
import type { Locale } from '@/lib/i18n/types'

interface LanguageToggleProps {
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Compact EN/AR language switcher.
 * EN = globe icon, AR = crescent icon (Islamic reference).
 */
export function LanguageToggle({ size = 'md', className = '' }: LanguageToggleProps) {
  const { locale, setLocale } = useLocale()
  const t = useT()

  const options: { key: Locale; label: string; Icon: typeof Globe }[] = [
    { key: 'en', label: 'EN', Icon: Globe },
    { key: 'ar', label: 'AR', Icon: MoonStar },
  ]

  const pill = size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm'
  const iconSize = size === 'sm' ? 14 : 16

  return (
    <div
      className={`inline-flex rounded-full border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-0.5 ${className}`}
      role="radiogroup"
      aria-label={t.common.languageSwitcherAria}
    >
      {options.map(({ key, label, Icon }) => {
        const active = locale === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setLocale(key)}
            className={`
              inline-flex items-center gap-1.5 rounded-full px-3 font-medium transition-colors
              ${pill}
              ${active ? 'bg-[var(--color-brand-red)] text-white shadow-sm' : 'text-[var(--color-brand-text-secondary)] hover:text-[var(--color-brand-text-primary)]'}
            `}
          >
            <Icon size={iconSize} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
