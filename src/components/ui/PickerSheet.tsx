'use client'

import type { ReactNode } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'

export interface PickerSheetProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  /** The pinned action (a Done button), or nothing for sheets that close on pick. */
  footer?: ReactNode
  children: ReactNode
  /** Stacking class: a picker opens over the sheet that owns the field. */
  zIndexClassName?: string
}

/** The frame every small picker sheet shares (day, number, option): the standard header, the body, an optional Done. */
export function PickerSheet({ open, onClose, title, subtitle, footer, children, zIndexClassName = 'z-[110]' }: PickerSheetProps) {
  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName={zIndexClassName} panelClassName="md:w-[440px]" padContent>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <V3SheetHeader title={title} subtitle={subtitle} onClose={onClose} />
        {children}
        {footer ? <div className="sheet-cta shrink-0 pt-1">{footer}</div> : null}
      </div>
    </ModalShell>
  )
}
