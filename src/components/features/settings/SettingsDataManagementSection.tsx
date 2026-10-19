'use client'

import { RefObject } from 'react'
import { AlertTriangle, Database, Download, FileSpreadsheet, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useT } from '@/lib/i18n'

export interface SettingsDataManagementSectionProps {
  fileInputRef: RefObject<HTMLInputElement | null>
  showResetConfirm: boolean
  onShowResetConfirm: (v: boolean) => void
  onExport: () => void
  onExportExpenses: () => void
  onImportChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onStartFresh: () => void
  isResetting?: boolean
}

/**
 * JSON backup / import and destructive reset.
 */
export function SettingsDataManagementSection({
  fileInputRef,
  showResetConfirm,
  onShowResetConfirm,
  onExport,
  onExportExpenses,
  onImportChange,
  onStartFresh,
  isResetting = false,
}: SettingsDataManagementSectionProps) {
  const t = useT()

  return (
    <Card render={<section />} padding="lg" className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Database className="w-5 h-5 text-[var(--color-brand-primary-ink)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {t.settings.dataTitle}
        </h2>
      </div>

      <p className="text-xs text-[var(--color-brand-text-muted)] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 px-3 py-2.5">
        {t.settings.dataIntro}
      </p>
      <p className="text-xs text-[var(--color-brand-amber)]/95 rounded-xl border border-[var(--color-brand-amber)]/35 bg-[var(--color-brand-amber)]/10 px-3 py-2.5">
        {t.settings.dataDeviceOnlyNote}
      </p>

      <Card
        render={<button type="button" onClick={onExportExpenses} />}
        variant="brand"
        radius="sm"
        padding="none"
        interactive
        className="flex w-full items-center gap-3 border-[var(--color-brand-primary)]/40 px-4 py-3 text-start"
      >
        <FileSpreadsheet className="h-5 w-5 shrink-0 text-[var(--color-brand-primary-ink)]" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--color-brand-text-primary)]">
            {t.settings.dataExportExpenses}
          </span>
          <span className="block text-xs text-[var(--color-brand-text-muted)]">
            {t.settings.dataExportExpensesHint}
          </span>
        </span>
        <Download className="h-4 w-4 shrink-0 text-[var(--color-brand-primary-ink)]" />
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="touch" onClick={onExport}>
          <Download className="w-4 h-4" />
          {t.settings.dataDownload}
        </Button>

        <Button variant="outline" size="touch" onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4" />
          {t.settings.dataRestore}
        </Button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={onImportChange} />

        {isResetting ? (
          <Button
            variant="outline"
            size="touch"
            disabled
            className="border-red-900/50 bg-transparent text-[var(--color-brand-red)] dark:border-red-900/50 dark:bg-transparent"
          >
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {t.settings.dataStartFresh}
          </Button>
        ) : !showResetConfirm ? (
          <Button
            variant="outline"
            size="touch"
            onClick={() => onShowResetConfirm(true)}
            className="border-red-900/50 bg-transparent text-[var(--color-brand-primary-ink)] hover:bg-red-900/20 hover:text-[var(--color-brand-primary-ink)] dark:border-red-900/50 dark:bg-transparent dark:hover:bg-red-900/20"
          >
            <Trash2 className="w-4 h-4" />
            {t.settings.dataStartFresh}
          </Button>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-900/50">
            <AlertTriangle className="w-5 h-5 text-[var(--color-brand-red)]" />
            <span className="text-sm text-[var(--color-brand-red)]">{t.settings.dataResetWarning}</span>
            <Button
              size="sm"
              onClick={() => {
                onShowResetConfirm(false)
                void onStartFresh()
              }}
              className="rounded-lg px-3 text-xs"
            >
              {t.settings.dataConfirmReset}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShowResetConfirm(false)}
              className="rounded-lg px-3 text-xs"
            >
              {t.settings.dataCancelReset}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
