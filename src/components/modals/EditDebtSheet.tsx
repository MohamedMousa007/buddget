'use client'

import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { EditDebtForm } from '@/components/features/debts/EditDebtForm'

export function EditDebtSheet() {
  const { debts } = useFinanceStore()
  const { activeModal, setActiveModal, editingDebtId, setEditingDebtId } = useSettingsStore()
  const isOpen = activeModal === 'editDebt'
  const debt = debts.find((d) => d.id === editingDebtId)

  const handleClose = () => {
    setEditingDebtId(null)
    setActiveModal(null)
  }

  if (!debt) return null

  return (
    <ModalShell open={isOpen} onBackdropClick={handleClose}>
      <EditDebtForm debt={debt} isOpen={isOpen} onClose={handleClose} />
    </ModalShell>
  )
}
