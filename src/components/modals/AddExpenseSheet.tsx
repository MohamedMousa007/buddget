'use client'

import { ModalShell } from '@/components/modals/ModalShell'
import { useAddExpenseSheet } from '@/hooks/useAddExpenseSheet'
import { ExpenseSheetForm } from '@/components/features/expenses/ExpenseSheetForm'

/** Escape goes through ModalShell's guarded dismiss, so a started expense asks to save or discard first. */
export function AddExpenseSheet() {
  const sheet = useAddExpenseSheet()

  return (
    <ModalShell
      open={sheet.isOpen}
      onBackdropClick={sheet.handleClose}
      scrollChild
      panelClassName="rounded-t-4xl border-t-[var(--color-brand-border)]"
    >
      <ExpenseSheetForm
        mode="add"
        date={sheet.date}
        setDate={sheet.setDate}
        clock={sheet.clock}
        setClock={sheet.setClock}
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
        exclusion={sheet.exclusion}
        submitError={sheet.submitError}
        paymentMethods={sheet.paymentMethods}
        creditCardOutstandingHint={sheet.creditCardOutstandingHint}
        installment={sheet.installment}
        onSubmit={sheet.handleSubmit}
        onClose={sheet.handleClose}
      />
    </ModalShell>
  )
}
