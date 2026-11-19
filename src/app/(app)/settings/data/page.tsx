'use client'

import { DataCard } from '@/components/features/settings/hub/DataCard'
import { SettingsSubPageShell } from '@/components/features/settings/SettingsSubPageShell'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

/** Data and backup: what is not counted, export, and restore. */
export default function SettingsDataPage() {
  const copy = useSettingsHubCopy()
  return <SettingsSubPageShell title={copy.page.dataBackup}><DataCard /></SettingsSubPageShell>
}
