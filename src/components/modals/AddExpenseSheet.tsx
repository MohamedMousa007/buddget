'use client'

import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useAddExpenseSheet } from '@/hooks/useAddExpenseSheet'
import { AddExpenseForm } from '@/components/features/expenses/AddExpenseForm'
import { useT } from '@/lib/i18n'
import { MODAL_SHEET_OUTER_CLASS } from '@/lib/modals/modalFormClasses'

export function AddExpenseSheet() {
  const sheet = useAddExpenseSheet()
  const t = useT()
  useEscapeClose(sheet.isOpen, sheet.handleClose)

  return (
    <ModalShell open={sheet.isOpen} onBackdropClick={sheet.handleClose}>
      <div className={`${MODAL_SHEET_OUTER_CLASS} p-5`}>
        <div className="shrink-0">
          <ModalSheetHeader title={t.addExpense.sheetTitle} onClose={sheet.handleClose} />
        </div>
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
          subcategory={sheet.subcategory}
          setSubcategory={sheet.setSubcategory}
          categoryChipOptions={sheet.categoryChipOptions}
          paymentMethodId={sheet.paymentMethodId}
          setPaymentMethodId={sheet.setPaymentMethodId}
          notes={sheet.notes}
          setNotes={sheet.setNotes}
          submitError={sheet.submitError}
          setSubmitError={sheet.setSubmitError}
          paymentMethods={sheet.paymentMethods}
          creditCardOutstandingHint={sheet.creditCardOutstandingHint}
        />
        <div className="shrink-0 pt-4">
          <button
            type="button"
            onClick={sheet.handleSubmit}
            disabled={
              !sheet.description.trim() ||
              !sheet.amount.trim() ||
              Number.isNaN(parseFloat(sheet.amount)) ||
              parseFloat(sheet.amount) <= 0
            }
            className="w-full py-3.5 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.addExpense.buttonSubmit}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
