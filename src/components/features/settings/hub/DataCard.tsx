'use client'

import { useRef } from 'react'
import { FileSpreadsheet, FileUp, Save } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { SettingsSection } from '@/components/features/settings/SettingsSection'
import { SETTING_ICONS } from '@/components/features/settings/settingIcons'
import { GROUP_TONE } from '@/components/features/settings/groupMeta'
import { useSettingsPage } from '@/hooks/useSettingsPage'
import { NotCountedSheet, useNotCountedCount } from './NotCountedSheet'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'

/**
 * Export and import. When the data lives in the account there is nothing to back up, so the only action is a CSV
 * export; on a device that holds its own data the export offers a backup file too, and a backup can be imported.
 */
export function DataCard() {
  const copy = useSettingsHubCopy()
  const d = copy.data
  const s = useSettingsPage()
  const sheet = useSettingsStore((st) => st.settingsSheet)
  const openSheet = useSettingsStore((st) => st.openSettingsSheet)
  const fileRef = useRef<HTMLInputElement>(null)
  const synced = Boolean(s.user)
  const tone = GROUP_TONE.data
  const notCounted = useNotCountedCount()

  return (
    <>
      <SettingsSection title={d.title}>
        <SettingsRow icon={SETTING_ICONS.coins} tone={tone} title={copy.items.notCounted.label} subtitle={notCounted > 0 ? copy.notCounted.some(notCounted) : copy.notCounted.subtitle} onClick={() => openSheet('notCounted')} settingId="notCounted" />
        {synced ? (
          <SettingsRow icon={SETTING_ICONS.download} tone={tone} title={copy.items.exportData.label} subtitle={d.csv} onClick={() => void s.handleExportExpensesCsv()} settingId="exportData" />
        ) : (
          <>
            <SettingsRow icon={SETTING_ICONS.download} tone={tone} title={copy.items.exportData.label} subtitle={d.exportHint} onClick={() => openSheet('export')} settingId="exportData" />
            <SettingsRow icon={SETTING_ICONS.upload} tone={tone} title={copy.items.restoreBackup.label} subtitle={d.importHint} onClick={() => fileRef.current?.click()} settingId="restoreBackup" />
          </>
        )}
      </SettingsSection>
      <NotCountedSheet open={sheet === 'notCounted'} onClose={() => openSheet(null)} />
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={s.handleImport} />
      {s.importBanner ? (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm font-medium ${s.importBanner.variant === 'success' ? 'bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]' : 'bg-[var(--color-brand-red-soft)] text-[var(--color-brand-red)]'}`}>
          {s.importBanner.text}
        </p>
      ) : null}

      <ModalShell open={sheet === 'export' && !synced} onBackdropClick={() => openSheet(null)} zIndexClassName="z-[110]" panelClassName="md:w-[420px]" padContent>
        <div className="flex flex-col gap-3">
          <V3SheetHeader title={d.export} onClose={() => openSheet(null)} />
          <div className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl border border-[var(--color-brand-border)]">
            <SettingsRow icon={FileSpreadsheet} tone={tone} title={d.csv} subtitle={d.csvHint} onClick={() => { void s.handleExportExpensesCsv(); openSheet(null) }} />
            <SettingsRow icon={Save} tone={tone} title={d.backup} subtitle={d.backupHint} onClick={() => { s.handleExport(); openSheet(null) }} />
          </div>
          <p className="flex items-center gap-2 text-xs text-[var(--color-brand-text-muted)]"><FileUp className="size-4 shrink-0" aria-hidden />{d.importHint}</p>
        </div>
      </ModalShell>
    </>
  )
}
