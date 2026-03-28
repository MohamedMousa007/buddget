'use client'

import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useAddExpenseSheet } from '@/hooks/useAddExpenseSheet'
import { AddExpenseForm } from '@/components/features/expenses/AddExpenseForm'

export function AddExpenseSheet() {
  const sheet = useAddExpenseSheet()
  useEscapeClose(sheet.isOpen, sheet.handleClose)

  return (
    <ModalShell open={sheet.isOpen} onBackdropClick={sheet.handleClose}>
      <div className="p-6">
        <ModalSheetHeader title="Add Expense" onClose={sheet.handleClose} />
        <AddExpenseForm
          date={sheet.date}
          setDate={sheet.setDate}
          description={sheet.description}
          setDescription={sheet.setDescription}
          amount={sheet.amount}
          setAmount={sheet.setAmount}
          currency={sheet.currency}
          setCurrency={sheet.setCurrency}
          category={sheet.category}
          setCategory={sheet.setCategory}
          paymentMethodId={sheet.paymentMethodId}
          setPaymentMethodId={sheet.setPaymentMethodId}
          isRecurring={sheet.isRecurring}
          setIsRecurring={sheet.setIsRecurring}
          notes={sheet.notes}
          setNotes={sheet.setNotes}
          submitError={sheet.submitError}
          setSubmitError={sheet.setSubmitError}
          paymentMethods={sheet.paymentMethods}
          onCancel={sheet.handleClose}
          onSubmit={sheet.handleSubmit}
        />
      </div>
    </ModalShell>
  )
}
