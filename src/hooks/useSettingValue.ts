'use client'

import { useLocale } from '@/lib/i18n'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { SettingId } from '@/lib/settings/registry'

/** The current value to show beside a setting (search results, room rows), or undefined when it has none. */
export function useSettingValue(id: SettingId): string | undefined {
  const copy = useSettingsHubCopy()
  const { locale } = useLocale()
  const settings = useFinanceStore((s) => s.settings)
  switch (id) {
    case 'baseCurrency': return settings.baseCurrency
    case 'payCycle': return String(settings.monthStartDay)
    case 'language': return locale === 'ar' ? 'العربية' : 'English'
    case 'theme': return { light: copy.themeLight, dark: copy.themeDark, system: copy.themeAuto }[settings.theme]
    case 'budgetEntryMode': return settings.budgetEntryMode === 'amount' ? copy.moneyPage.entryAmount : copy.moneyPage.entryPercent
    default: return undefined
  }
}
