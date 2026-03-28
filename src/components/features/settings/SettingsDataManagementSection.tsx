'use client'

import { RefObject } from 'react'
import { AlertTriangle, Database, Download, Trash2, Upload } from 'lucide-react'
import type { FinanceStore } from '@/lib/store/types'

export interface SettingsDataManagementSectionProps {
  store: FinanceStore
  fileInputRef: RefObject<HTMLInputElement | null>
  showResetConfirm: boolean
  onShowResetConfirm: (v: boolean) => void
  onExport: () => void
  onImportChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

/**
 * JSON backup / import and destructive reset.
 */
export function SettingsDataManagementSection({
  store,
  fileInputRef,
  showResetConfirm,
  onShowResetConfirm,
  onExport,
  onImportChange,
}: SettingsDataManagementSectionProps) {
  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Database className="w-5 h-5 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          Data Management
        </h2>
      </div>

      <p className="text-xs text-[var(--color-brand-text-muted)] rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 px-3 py-2.5">
        Data stays in this browser (local storage). Export a JSON backup from time to time — especially with years of
        transactions — so you can recover quickly if you clear site data or switch devices.
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          <Download className="w-4 h-4" />
          Export All Data (JSON)
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          <Upload className="w-4 h-4" />
          Import Data (JSON)
        </button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={onImportChange} />

        {!showResetConfirm ? (
          <button
            type="button"
            onClick={() => onShowResetConfirm(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-900/50 text-sm text-[var(--color-brand-red)] hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Reset All Data
          </button>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-900/20 border border-red-900/50">
            <AlertTriangle className="w-5 h-5 text-[var(--color-brand-red)]" />
            <span className="text-sm text-[var(--color-brand-red)]">Are you sure?</span>
            <button
              type="button"
              onClick={() => {
                store.resetAllData()
                onShowResetConfirm(false)
              }}
              className="px-3 py-1 rounded-lg bg-[var(--color-brand-red)] text-white text-xs font-medium"
            >
              Yes, reset
            </button>
            <button
              type="button"
              onClick={() => onShowResetConfirm(false)}
              className="px-3 py-1 rounded-lg border border-[var(--color-brand-border)] text-xs text-[var(--color-brand-text-secondary)]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
