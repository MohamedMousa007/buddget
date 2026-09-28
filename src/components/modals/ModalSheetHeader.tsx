'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import { useModalTitleId } from '@/components/modals/ModalShell'
import { IconButton } from '@/components/ui/IconButton'

/**
 * Deprecated: ModalShell now always renders the drag-handle grab strip, so a
 * header-level handle would double up. Kept as a no-op to avoid touching every
 * header call site.
 */
export function ModalSheetDragHandle() {
  return null
}

export interface ModalSheetHeaderProps {
  title: string
  onClose: () => void
  /** Margin below the title row (debt sheet historically used tighter spacing). */
  titleRowClassName?: string
}

export function ModalSheetHeader({ title, onClose, titleRowClassName = 'mb-4' }: ModalSheetHeaderProps) {
  const t = useT()
  return (
    <>
      <ModalSheetDragHandle />
      <div
        className={cn(
          'flex items-center justify-between shadow-none',
          titleRowClassName,
        )}
      >
        <h3 id={useModalTitleId()} className="text-base font-semibold text-[var(--color-brand-text-primary)]">{title}</h3>
        <IconButton onClick={onClose} aria-label={t.common.close}>
          <X className="w-5 h-5 text-[var(--color-brand-text-muted)]" aria-hidden />
        </IconButton>
      </div>
    </>
  )
}
