'use client'

import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { IncomeSheetForm } from '@/components/modals/IncomeSheetForm'

export function EditIncomeSheet() {
  const { incomeSources } = useFinanceStore()
  const { activeModal, setActiveModal, editingIncomeId, setEditingIncomeId } = useSettingsStore()
  const source = incomeSources.find((s) => s.id === editingIncomeId)

  const close = () => {
    setActiveModal(null)
    setEditingIncomeId(null)
  }

  if (!source) return null
  return <IncomeSheetForm key={source.id} open={activeModal === 'editIncome'} onClose={close} source={source} />
}
