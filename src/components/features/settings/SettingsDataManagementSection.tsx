'use client'

import { RefObject } from 'react'
import { AlertTriangle, Database, Download, FileSpreadsheet, Trash2, Upload } from 'lucide-react'
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
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Database className="w-5 h-5 text-[var(--color-brand-red)]" />
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

      <button
        type="button"
        onClick={onExportExpenses}
        className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-brand-red)]/40 bg-[var(--color-brand-red)]/10 px-4 py-3 text-start transition-colors hover:bg-[var(--color-brand-red)]/15"
      >
        <FileSpreadsheet className="h-5 w-5 shrink-0 text-[var(--color-brand-red)]" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--color-brand-text-primary)]">
            {t.settings.dataExportExpenses}
          </span>
          <span className="block text-xs text-[var(--color-brand-text-muted)]">
            {t.settings.dataExportExpensesHint}
          </span>
        </span>
        <Download className="h-4 w-4 shrink-0 text-[var(--color-brand-red)]" />
      </button>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          <Download className="w-4 h-4" />
          {t.settings.dataDownload}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          <Upload className="w-4 h-4" />
          {t.settings.dataRestore}
        </button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={onImportChange} />

        {isResetting ? (
          <button
            type="button"
            disabled
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-900/50 text-sm text-[var(--color-brand-red)] opacity-60 cursor-not-allowed"
          >
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            {t.settings.dataStartFresh}
          </button>
        ) : !showResetConfirm ? (
          <button
            type="button"
            onClick={() => onShowResetConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-900/50 text-sm text-[var(--color-brand-red)] hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {t.settings.dataStartFresh}
          </button>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-900/50">
            <AlertTriangle className="w-5 h-5 text-[var(--color-brand-red)]" />
            <span className="text-sm text-[var(--color-brand-red)]">{t.settings.dataResetWarning}</span>
            <button
              type="button"
              onClick={() => {
                onShowResetConfirm(false)
                void onStartFresh()
              }}
              className="px-3 py-1 rounded-lg bg-[var(--color-brand-red)] text-white text-xs font-medium"
            >
              {t.settings.dataConfirmReset}
            </button>
            <button
              type="button"
              onClick={() => onShowResetConfirm(false)}
              className="px-3 py-1 rounded-lg border border-[var(--color-brand-border)] text-xs text-[var(--color-brand-text-secondary)]"
            >
              {t.settings.dataCancelReset}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
