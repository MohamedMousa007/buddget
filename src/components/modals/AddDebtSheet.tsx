'use client'

import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useAddDebtSheet } from '@/hooks/useAddDebtSheet'
import { ModalShell } from '@/components/modals/ModalShell'
import { AddDebtSheetHeader } from '@/components/features/debts/AddDebtSheetHeader'
import { AddDebtModeTabs } from '@/components/features/debts/AddDebtModeTabs'
import { AddDebtNewForm } from '@/components/features/debts/AddDebtNewForm'
import { AddDebtPaymentForm } from '@/components/features/debts/AddDebtPaymentForm'
import { useT } from '@/lib/i18n'

/**
 * Bottom sheet: create debt or record payment. Logic in `useAddDebtSheet`.
 */
export function AddDebtSheet() {
  const d = useAddDebtSheet()
  const t = useT()
  useEscapeClose(d.isOpen, d.closeSheet)

  const title = d.debtSheetPaymentOnly
    ? t.addDebt.titlePayment
    : d.mode === 'new'
      ? t.addDebt.titleNew
      : t.addDebt.titlePayment

  return (
    <ModalShell open={d.isOpen} onBackdropClick={d.closeSheet}>
      <div className="p-6">
        <AddDebtSheetHeader title={title} onClose={d.closeSheet} />
        {!d.debtSheetPaymentOnly ? <AddDebtModeTabs mode={d.mode} onModeChange={d.setMode} /> : null}
        {d.mode === 'new' && !d.debtSheetPaymentOnly ? (
          <AddDebtNewForm
            settings={d.settings}
            name={d.name}
            setName={d.setName}
            person={d.person}
            setPerson={d.setPerson}
            description={d.description}
            setDescription={d.setDescription}
            isGold={d.isGold}
            setIsGold={d.setIsGold}
            startingBalance={d.startingBalance}
            setStartingBalance={d.setStartingBalance}
            currency={d.currency}
            setCurrency={d.setCurrency}
            goldKarat={d.goldKarat}
            setGoldKarat={d.setGoldKarat}
            notes={d.notes}
            setNotes={d.setNotes}
            onCancel={d.closeSheet}
            onSubmit={d.handleAddDebt}
          />
        ) : (
          <AddDebtPaymentForm
            settings={d.settings}
            payableDebts={d.payableDebts}
            selectedDebtId={d.selectedDebtId}
            setSelectedDebtId={d.setSelectedDebtId}
            selectedDebt={d.selectedDebt}
            selectedPayable={d.selectedPayable}
            paymentDate={d.paymentDate}
            setPaymentDate={d.setPaymentDate}
            paymentAmount={d.paymentAmount}
            setPaymentAmount={(v) => {
              d.setPaymentAmount(v)
              d.setPaymentRateError('')
            }}
            paymentCurrency={d.paymentCurrency}
            setPaymentCurrency={(v) => {
              d.setPaymentCurrency(v)
              d.setPaymentRateError('')
            }}
            paymentRateError={d.paymentRateError}
            paymentPreviewText={d.paymentPreview()}
            paymentMethods={d.paymentMethods}
            paymentMethodId={d.paymentMethodId}
            setPaymentMethodId={d.setPaymentMethodId}
            paymentNotes={d.paymentNotes}
            setPaymentNotes={d.setPaymentNotes}
            onCancel={d.closeSheet}
            onSubmit={d.handleAddPayment}
          />
        )}
      </div>
    </ModalShell>
  )
}
