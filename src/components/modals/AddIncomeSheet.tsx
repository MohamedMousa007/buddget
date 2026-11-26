'use client'

import { useShallow } from 'zustand/react/shallow'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { IncomeSheetForm } from '@/components/modals/IncomeSheetForm'
import { ModalShell } from '@/components/modals/ModalShell'
import { AddIncomeForm } from '@/components/modals/AddIncomeForm'

/** + → Money in (`addIncome`, one-time) and Paydays → Add / "Make this recurring" (`addPayday`). */
export function AddIncomeSheet() {
  const { activeModal, setActiveModal, paydayPrefill } = useSettingsStore(
    useShallow((s) => ({ activeModal: s.activeModal, setActiveModal: s.setActiveModal, paydayPrefill: s.paydayPrefill })),
  )
  const close = () => setActiveModal(null)
  const addOpen = activeModal === 'addIncome'
  return (
    <>
      <ModalShell open={addOpen} onBackdropClick={close} scrollChild>
        {addOpen ? <AddIncomeForm onClose={close} /> : null}
      </ModalShell>
      <IncomeSheetForm mode="payday" open={activeModal === 'addPayday'} onClose={close} prefill={paydayPrefill} />
    </>
  )
}
