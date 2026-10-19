'use client'

import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { SettingsImportBanner } from '@/components/features/settings/SettingsImportBanner'
import { SettingsDataManagementSection } from '@/components/features/settings/SettingsDataManagementSection'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { ROOM_TONE } from '@/components/features/settings/roomMeta'
import { useOpenSetting } from '@/hooks/useOpenSetting'
import { useSettingsPage } from '@/hooks/useSettingsPage'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useT } from '@/lib/i18n'

export default function SettingsDataPage() {
  const t = useT()
  const s = useSettingsPage()
  const copy = useSettingsHubCopy()
  const open = useOpenSetting()

  return (
    <SettingsSubPageShell title={t.settings.hub.data}>
      <SettingsSection title={copy.dataPage.tools}>
        <SettingsRow
          icon={SETTING_ICONS.refresh}
          tone={ROOM_TONE.data}
          title={copy.dataPage.resetTips}
          subtitle={copy.dataPage.resetTipsHint}
          onClick={() => open('resetTips')}
          settingId="resetTips"
        />
      </SettingsSection>
      <SettingsImportBanner banner={s.importBanner} />
      <SettingsDataManagementSection
        fileInputRef={s.fileInputRef}
        showResetConfirm={s.showResetConfirm}
        onShowResetConfirm={s.setShowResetConfirm}
        onExport={s.handleExport}
        onExportExpenses={s.handleExportExpensesCsv}
        onImportChange={s.handleImport}
        onStartFresh={s.handleStartFresh}
        isResetting={s.isResetting}
      />
    </SettingsSubPageShell>
  )
}
