'use client'

import { useShallow } from 'zustand/react/shallow'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { IncomeSheetForm } from '@/components/modals/IncomeSheetForm'

/** + → Money in (`addIncome`, one-time) and Paydays → Add / "Make this recurring" (`addPayday`). */
export function AddIncomeSheet() {
  const { activeModal, setActiveModal, paydayPrefill } = useSettingsStore(
    useShallow((s) => ({ activeModal: s.activeModal, setActiveModal: s.setActiveModal, paydayPrefill: s.paydayPrefill })),
  )
  const close = () => setActiveModal(null)
  return (
    <>
      <IncomeSheetForm mode="oneTime" open={activeModal === 'addIncome'} onClose={close} />
      <IncomeSheetForm mode="payday" open={activeModal === 'addPayday'} onClose={close} prefill={paydayPrefill} />
    </>
  )
}
