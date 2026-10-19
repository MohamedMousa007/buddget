'use client'

import type { ReactNode } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'

/** The app's `ModalShell` + `ModalSheetHeader`, composed once for the portal's dialogs. */
export function AdminSheet({ open, title, onClose, children, wide = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <ModalShell open={open} onBackdropClick={onClose} padContent panelClassName={wide ? 'md:max-w-2xl' : ''}>
      <ModalSheetHeader title={title} onClose={onClose} />
      {children}
    </ModalShell>
  )
}
