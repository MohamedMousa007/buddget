'use client'

import { useLocale, useT } from '@/lib/i18n'
import { Globe, MoonStar } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { Locale } from '@/lib/i18n/types'

interface LanguageToggleProps {
  className?: string
  /** Short “EN | ع” labels with no icons, for tight rows such as the profile menu. Default look is unchanged. */
  compact?: boolean
}

/**
 * Compact EN/AR language switcher.
 * EN = globe icon, AR = crescent icon (Islamic reference).
 *
 * This is a one-of-two choice, so it is a {@link SegmentedControl} — which owns the
 * radiogroup semantics and the arrow-key handling. It previously hand-rolled the
 * same thing and ended up with `role="radio"` children carrying `aria-pressed`
 * instead of `aria-checked`, which is not a valid radio.
 *
 * The old `size` prop is gone: both call sites passed "sm", and the segmented
 * control has one height so the switcher matches every other segmented row.
 */
export function LanguageToggle({ className, compact = false }: LanguageToggleProps) {
  const { locale, setLocale } = useLocale()
  const t = useT()

  return (
    <SegmentedControl<Locale>
      ariaLabel={t.common.languageSwitcherAria}
      value={locale}
      onChange={setLocale}
      fill={false}
      className={className}
      options={
        compact
          ? [
              { value: 'en', label: 'EN' },
              { value: 'ar', label: 'ع' },
            ]
          : [
              { value: 'en', label: 'EN', icon: <Globe /> },
              { value: 'ar', label: 'AR', icon: <MoonStar /> },
            ]
      }
    />
  )
}
