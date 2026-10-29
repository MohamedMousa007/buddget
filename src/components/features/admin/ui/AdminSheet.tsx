'use client'

import type { ReactNode } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'

/** The app's `ModalShell` + `ModalSheetHeader`, composed once for the portal's dialogs. */
export function AdminSheet({ open, title, onClose, children, wide = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <ModalShell open={open} onBackdropClick={onClose} padContent panelClassName={wide ? 'md:max-w-2xl' : ''}>
      <V3SheetHeader title={title} onClose={onClose} />
      {children}
    </ModalShell>
  )
}
