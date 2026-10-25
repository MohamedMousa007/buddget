'use client'

import { PaymentMethodSetupSheet } from '@/components/features/payments/PaymentMethodSetupSheet'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'

/**
 * Debt-tab credit-card add & edit — the SAME payment-method setup sheet (§6 unify),
 * locked to the Credit card type. Add auto-creates the card's debt + persists terms;
 * Edit opens the linked payment method prefilled (card edit routes here, not to the
 * generic debt form).
 */
export function AddCreditCardSheet() {
  const t = useT().debts
  const confirm = useConfirm()
  const deleteDebt = useFinanceStore((s) => s.deleteDebt)
  const deletePaymentMethod = useFinanceStore((s) => s.deletePaymentMethod)
  const activeModal = useSettingsStore((s) => s.activeModal)
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const editingDebtId = useSettingsStore((s) => s.editingDebtId)
  const setEditingDebtId = useSettingsStore((s) => s.setEditingDebtId)
  const baseCurrency = useFinanceStore((s) => s.settings.baseCurrency)
  const debts = useFinanceStore((s) => s.debts)
  const paymentMethods = useFinanceStore((s) => s.paymentMethods)

  const editingDebt = activeModal === 'editDebt' ? debts.find((d) => d.id === editingDebtId) : undefined
  const isCardEdit = editingDebt?.debtType === 'credit_card'
  const editingPm = isCardEdit ? paymentMethods.find((m) => m.id === editingDebt?.linkedPaymentMethodId) ?? null : null

  const open = activeModal === 'addCreditCard' || isCardEdit

  const close = () => {
    setEditingDebtId(null)
    setActiveModal(null)
  }

  const removeCard = async () => {
    if (!editingDebt || !editingPm) return
    if (!(await confirm({ title: t.deleteCardLabel, body: t.deleteCardBody, destructive: true }))) return
    deleteDebt(editingDebt.id)
    deletePaymentMethod(editingPm.id)
    close()
  }

  return (
    <PaymentMethodSetupSheet
      open={open}
      editing={editingPm}
      baseCurrency={baseCurrency}
      lockType="credit_card"
      titleOverride={isCardEdit ? 'Edit credit card' : 'Add credit card'}
      onClose={close}
      onDelete={removeCard}
      deleteLabel={t.deleteCardLabel}
    />
  )
}
