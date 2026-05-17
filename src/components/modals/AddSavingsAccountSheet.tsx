'use client'

import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { AddSavingsAccountForm } from '@/components/features/savings/AddSavingsAccountForm'
import { useAutoStartTour } from '@/hooks/useTutorial'
import { useT } from '@/lib/i18n'

export interface AddSavingsAccountSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * Thin sheet wrapper around {@link AddSavingsAccountForm}. Used for the standalone
 * "create savings account" flow (e.g. empty-state CTA). The same form is also embedded
 * as a tab inside {@link AddToSavingsSheet}.
 */
export function AddSavingsAccountSheet({ open, onClose }: AddSavingsAccountSheetProps) {
  const t = useT()
  useAutoStartTour('addSavingsTour', open)
  if (!open) return null
  return (
    <ModalShell open={open} onBackdropClick={onClose}>
      <div className="p-5 max-h-[90vh] overflow-y-auto">
        <ModalSheetHeader title={t.savings.sheetAddNewTitle} onClose={onClose} />
        <div className="mt-4">
          <AddSavingsAccountForm onDone={onClose} />
        </div>
      </div>
    </ModalShell>
  )
}
