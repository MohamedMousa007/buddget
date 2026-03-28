'use client'

import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { EditIncomeForm } from '@/components/features/income/EditIncomeForm'

export function EditIncomeSheet() {
  const { incomeSources } = useFinanceStore()
  const { activeModal, setActiveModal, editingIncomeId, setEditingIncomeId } = useSettingsStore()
  const isOpen = activeModal === 'editIncome'
  const source = incomeSources.find((s) => s.id === editingIncomeId)

  const close = () => {
    setActiveModal(null)
    setEditingIncomeId(null)
  }

  const shellOpen = isOpen && !!source

  return (
    <ModalShell open={shellOpen} onBackdropClick={close}>
      {source ? <EditIncomeForm key={source.id} source={source} onClose={close} /> : null}
    </ModalShell>
  )
}
