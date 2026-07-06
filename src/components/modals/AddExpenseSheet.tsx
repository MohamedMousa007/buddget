'use client'

import { ModalShell } from '@/components/modals/ModalShell'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useAddExpenseSheet } from '@/hooks/useAddExpenseSheet'
import { ExpenseSheetForm } from '@/components/features/expenses/ExpenseSheetForm'

export function AddExpenseSheet() {
  const sheet = useAddExpenseSheet()
  useEscapeClose(sheet.isOpen, sheet.handleClose)

  return (
    <ModalShell
      open={sheet.isOpen}
      onBackdropClick={sheet.handleClose}
      panelClassName="rounded-t-[30px] border-t-[#23232f]"
    >
      <ExpenseSheetForm
        mode="add"
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
        notes={sheet.notes}
        setNotes={sheet.setNotes}
        submitError={sheet.submitError}
        paymentMethods={sheet.paymentMethods}
        creditCardOutstandingHint={sheet.creditCardOutstandingHint}
        onSubmit={sheet.handleSubmit}
        onClose={sheet.handleClose}
      />
    </ModalShell>
  )
}
