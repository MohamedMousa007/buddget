'use client'

import { useCallback } from 'react'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { useActionToast } from '@/components/ui/ActionToast'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense } from '@/lib/store/types'

/**
 * Deletes that touch two records at once. A debt payment and its expense always go together
 * (either side starts the delete), the user confirms the money move, and Undo brings both back.
 */
export function useLinkedDelete() {
  const t = useT()
  const confirm = useConfirm()
  const toast = useActionToast()

  const removeDebtPayment = useCallback(
    async (paymentId: string, from: 'payment' | 'expense' = 'payment'): Promise<boolean> => {
      const copy = t.moneyFlows
      const payment = useFinanceStore.getState().debtPayments.find((p) => p.id === paymentId)
      const fundingNote = !payment?.fundedFromSavings ? '' : payment.fundedFromSavingsTxId ? copy.deletePaymentReturnsMoney : copy.deletePaymentKeepsMoneyOut
      const ok = await confirm({
        title: from === 'payment' ? copy.deletePaymentTitle : copy.deletePaidExpenseTitle,
        body: `${from === 'payment' ? copy.deletePaymentBody : copy.deletePaidExpenseBody}${fundingNote ? ` ${fundingNote}` : ''}`,
        confirmLabel: t.common.delete,
        destructive: true,
      })
      if (!ok) return false
      const state = useFinanceStore.getState()
      const snapshot = state.deleteDebtPayment(paymentId)
      if (!snapshot) return false
      toast(copy.paymentDeleted, {
        undo: () => useFinanceStore.getState().restoreDebtPayment(snapshot),
        undoLabel: t.common.undo,
      })
      return true
    },
    [confirm, toast, t],
  )

  const removeExpense = useCallback(
    async (expense: Expense): Promise<boolean> => {
      const state = useFinanceStore.getState()
      const pairedId = expense.linkedDebtPaymentId
      if (pairedId && state.debtPayments.some((p) => p.id === pairedId)) {
        return removeDebtPayment(pairedId, 'expense')
      }
      state.deleteExpense(expense.id)
      toast(t.expenses.expenseDeleted, {
        undo: () => useFinanceStore.getState().restoreExpense(expense),
        undoLabel: t.common.undo,
      })
      return true
    },
    [removeDebtPayment, toast, t],
  )

  return { removeDebtPayment, removeExpense }
}
