'use client'

import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SettingsImportBanner } from '@/components/features/settings/SettingsImportBanner'
import { SettingsDataManagementSection } from '@/components/features/settings/SettingsDataManagementSection'
import { useSettingsPage } from '@/hooks/useSettingsPage'
import { useT } from '@/lib/i18n'

export default function SettingsDataPage() {
  const t = useT()
  const s = useSettingsPage()

  return (
    <SettingsSubPageShell title={t.settings.hub.data}>
      <SettingsImportBanner banner={s.importBanner} />
      <SettingsDataManagementSection
        fileInputRef={s.fileInputRef}
        showResetConfirm={s.showResetConfirm}
        onShowResetConfirm={s.setShowResetConfirm}
        onExport={s.handleExport}
        onImportChange={s.handleImport}
        onStartFresh={s.handleStartFresh}
      />
    </SettingsSubPageShell>
  )
}
