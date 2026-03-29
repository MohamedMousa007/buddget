'use client'

import { Copy, Download } from 'lucide-react'
import { useT } from '@/lib/i18n'

export interface ReportsExportBarProps {
  onExportCsv: () => void
  onCopySummary: () => void
}

/**
 * CSV export and clipboard summary actions.
 */
export function ReportsExportBar({ onExportCsv, onCopySummary }: ReportsExportBarProps) {
  const t = useT()
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={onExportCsv}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
      >
        <Download className="w-4 h-4" />
        {t.reports.downloadData}
      </button>
      <button
        type="button"
        onClick={onCopySummary}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
      >
        <Copy className="w-4 h-4" />
        {t.reports.copySummary}
      </button>
    </div>
  )
}
