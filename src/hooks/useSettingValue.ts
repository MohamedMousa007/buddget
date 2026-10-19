'use client'

import { useLocale } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { SettingId } from '@/lib/settings/registry'

/** The current value to show beside a setting (search results), or undefined when it has none. */
export function useSettingValue(id: SettingId): string | undefined {
  const copy = useSettingsHubCopy()
  const { locale } = useLocale()
  const settings = useFinanceStore((s) => s.settings)
  switch (id) {
    case 'baseCurrency': return settings.baseCurrency
    case 'secondaryCurrency': return settings.showSecondaryCurrency ? (settings.secondaryCurrency ?? undefined) : undefined
    case 'language': return locale === 'ar' ? 'العربية' : 'English'
    case 'theme': return settings.theme === 'dark' ? copy.themeDark : settings.theme === 'light' ? copy.themeLight : undefined
    default: return undefined
  }
}
