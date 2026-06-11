'use client'

import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SettingsCurrencySection } from '@/components/features/settings/SettingsCurrencySection'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'

export default function SettingsCurrencyPage() {
  const t = useT()
  const store = useFinanceStore()

  return (
    <SettingsSubPageShell title={t.settings.hub.currency}>
      <SettingsCurrencySection store={store} />
    </SettingsSubPageShell>
  )
}
