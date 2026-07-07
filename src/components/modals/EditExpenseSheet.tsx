'use client'

import { ModalShell } from '@/components/modals/ModalShell'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { EditExpenseForm } from '@/components/features/expenses/EditExpenseForm'

export function EditExpenseSheet() {
  const { expenses } = useFinanceStore()
  const { activeModal, setActiveModal, editingExpenseId, setEditingExpenseId } = useSettingsStore()
  const isOpen = activeModal === 'editExpense'
  const expense = expenses.find((e) => e.id === editingExpenseId)

  const close = () => {
    setActiveModal(null)
    setEditingExpenseId(null)
  }

  const shellOpen = isOpen && !!expense

  return (
    <ModalShell
      open={shellOpen}
      onBackdropClick={close}
      scrollChild
      panelClassName="rounded-t-[30px] border-t-[var(--color-brand-border)]"
    >
      {expense ? <EditExpenseForm key={expense.id} expense={expense} onClose={close} /> : null}
    </ModalShell>
  )
}
