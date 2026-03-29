'use client'

import { useEscapeClose } from '@/hooks/useEscapeClose'
import { ModalShell } from '@/components/modals/ModalShell'
import { ModalSheetHeader } from '@/components/modals/ModalSheetHeader'
import { useRecurringDebtPaymentSheet } from '@/hooks/useRecurringDebtPaymentSheet'
import { RecurringDebtPaymentForm } from '@/components/features/debts/RecurringDebtPaymentForm'
import { useT } from '@/lib/i18n'

export function AddRecurringDebtPaymentSheet() {
  const sheet = useRecurringDebtPaymentSheet()
  const t = useT()
  useEscapeClose(sheet.isOpen, sheet.close)

  return (
    <ModalShell open={sheet.isOpen} onBackdropClick={sheet.close}>
      <div className="p-6">
        <ModalSheetHeader title={t.recurringDebt.sheetTitle} onClose={sheet.close} />

        <p className="text-xs text-[var(--color-brand-text-muted)] mb-4">
          {t.recurringDebt.sheetDescription}
        </p>

        <RecurringDebtPaymentForm
          payableDebts={sheet.payableDebts}
          selectDebtValue={sheet.selectDebtValue}
          onDebtChange={sheet.setSelectedDebtId}
          amount={sheet.amount}
          onAmountChange={(v) => {
            sheet.setAmount(v)
            sheet.setError('')
          }}
          paymentCurrency={sheet.paymentCurrency}
          onPaymentCurrencyChange={(v) => {
            sheet.setPaymentCurrency(v)
            sheet.setError('')
          }}
          fiatOptions={sheet.fiatOptions}
          selectedDebt={sheet.selectedDebt}
          error={sheet.error || null}
          previewLine={sheet.previewLine}
          frequency={sheet.frequency}
          onFrequencyChange={sheet.setFrequency}
          nextDueDate={sheet.nextDueDate}
          onNextDueDateChange={sheet.setNextDueDate}
          paymentMethods={sheet.paymentMethods}
          paymentMethodId={sheet.paymentMethodId}
          onPaymentMethodChange={sheet.setPaymentMethodId}
          isActive={sheet.isActive}
          onIsActiveChange={sheet.setIsActive}
          notes={sheet.notes}
          onNotesChange={sheet.setNotes}
          onCancel={sheet.close}
          onSubmit={sheet.handleSubmit}
        />
      </div>
    </ModalShell>
  )
}
