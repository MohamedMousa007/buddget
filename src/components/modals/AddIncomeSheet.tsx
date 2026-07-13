'use client'

import { useShallow } from 'zustand/react/shallow'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { IncomeSheetForm } from '@/components/modals/IncomeSheetForm'

export function AddIncomeSheet() {
  const { activeModal, setActiveModal } = useSettingsStore(
    useShallow((s) => ({ activeModal: s.activeModal, setActiveModal: s.setActiveModal })),
  )
  return <IncomeSheetForm open={activeModal === 'addIncome'} onClose={() => setActiveModal(null)} />
}
