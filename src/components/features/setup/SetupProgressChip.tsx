'use client'

import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SetupChecklist } from '@/components/features/setup/SetupChecklist'
import { useT } from '@/lib/i18n'

/** The setup checklist as a bottom sheet; opened from the profile menu's "Finish setup" row. */
export function SetupChecklistSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  return (
    <ModalShell open={open} onBackdropClick={onClose} padContent>
      <V3SheetHeader title={t.setup.title} onClose={onClose} />
      <SetupChecklist onNavigate={onClose} className="border-0 p-0" />
    </ModalShell>
  )
}
