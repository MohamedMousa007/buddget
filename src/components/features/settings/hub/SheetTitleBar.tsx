'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

/** The title row of a settings sheet: an optional leading control, the title, and the close button. */
export function SheetTitleBar({ title, onClose, leading }: { title: string; onClose: () => void; leading?: ReactNode }) {
  const copy = useSettingsHubCopy()
  return (
    <div className="flex items-center justify-between gap-2">
      {leading}
      <h2 className="min-w-0 flex-1 truncate text-lg font-bold text-[var(--color-brand-text-primary)]">{title}</h2>
      <IconButton onClick={onClose} aria-label={copy.close} variant="tinted" size="sm" shape="round"><X className="h-full w-full" /></IconButton>
    </div>
  )
}
