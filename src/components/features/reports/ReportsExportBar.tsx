'use client'

import { Copy, Download } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

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
      <Button
        onClick={onExportCsv}
        variant="outline"
        size="touch"
      >
        <Download className="w-4 h-4" />
        {t.reports.downloadData}
      </Button>
      <Button
        onClick={onCopySummary}
        variant="outline"
        size="touch"
      >
        <Copy className="w-4 h-4" />
        {t.reports.copySummary}
      </Button>
    </div>
  )
}
