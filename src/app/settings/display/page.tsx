'use client'

import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SettingsAppPreferencesSection } from '@/components/features/settings/SettingsAppPreferencesSection'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'

export default function SettingsDisplayPage() {
  const t = useT()
  const store = useFinanceStore()

  return (
    <SettingsSubPageShell title={t.settings.hub.display}>
      <SettingsAppPreferencesSection store={store} />
    </SettingsSubPageShell>
  )
}
