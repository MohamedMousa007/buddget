'use client'

import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useAddDebtSheet } from '@/hooks/useAddDebtSheet'
import { ModalShell } from '@/components/modals/ModalShell'
import { AddDebtSheetHeader } from '@/components/features/debts/AddDebtSheetHeader'
import { AddDebtNewForm } from '@/components/features/debts/AddDebtNewForm'
import { AddDebtNewFormFooter } from '@/components/features/debts/AddDebtNewFormFooter'
import { AddDebtPaymentForm } from '@/components/features/debts/AddDebtPaymentForm'
import { PayDebtSelectList } from '@/components/features/debts/PayDebtSelectList'
import { useT } from '@/lib/i18n'
import { MODAL_SHEET_OUTER_CLASS } from '@/lib/modals/modalFormClasses'

/**
 * Bottom sheet: create debt or record payment. Logic in `useAddDebtSheet`.
 */
export function AddDebtSheet() {
  const d = useAddDebtSheet()
  const t = useT()
  useEscapeClose(d.isOpen, d.closeSheet)
  // Tour anchors live only on the "new debt" subform; gate accordingly.

  const title = d.isPayDebtFlow
    ? t.addDebt.titlePayDebt
    : d.debtSheetPaymentOnly
      ? t.addDebt.titlePayment
      : t.addDebt.titleNew

  const paymentFormProps = {
    settings: d.settings,
    payableDebts: d.payableDebts,
    selectedDebtId: d.selectedDebtId,
    setSelectedDebtId: d.setSelectedDebtId,
    selectedDebt: d.selectedDebt,
    selectedPayable: d.selectedPayable,
    paymentDate: d.paymentDate,
    setPaymentDate: d.setPaymentDate,
    paymentAmount: d.paymentAmount,
    setPaymentAmount: (v: string) => {
      d.setPaymentAmount(v)
      d.setPaymentRateError('')
    },
    paymentCurrency: d.paymentCurrency,
    setPaymentCurrency: (v: string) => {
      d.setPaymentCurrency(v)
      d.setPaymentRateError('')
    },
    paymentRateError: d.paymentRateError,
    paymentPreviewText: d.paymentPreview(),
    paymentMethods: d.paymentMethods,
    paymentMethodId: d.paymentMethodId,
    setPaymentMethodId: d.setPaymentMethodId,
    paymentNotes: d.paymentNotes,
    setPaymentNotes: d.setPaymentNotes,
    onCancel: d.closeSheet,
    onSubmit: d.handleAddPayment,
    paymentScheduleMode: d.paymentScheduleMode,
    setPaymentScheduleMode: d.setPaymentScheduleMode,
    recurringFrequency: d.recurringFrequency,
    setRecurringFrequency: d.setRecurringFrequency,
  } as const

  const newDebtSharedProps = {
    debtType: d.debtType,
    setDebtType: d.setDebtType,
    name: d.name,
    setName: d.setName,
    person: d.person,
    setPerson: d.setPerson,
    receivedVia: d.receivedVia,
    onReceivedViaChange: d.applyDebtReceivedVia,
    startingBalance: d.startingBalance,
    setStartingBalance: d.setStartingBalance,
    currency: d.currency,
    setCurrency: d.setCurrency,
    goldKarat: d.goldKarat,
    setGoldKarat: d.setGoldKarat,
    relationship: d.relationship,
    setRelationship: d.setRelationship,
    direction: d.direction,
    setDirection: d.setDirection,
    creditor: d.creditor,
    setCreditor: d.setCreditor,
    ccLast4: d.ccLast4,
    setCcLast4: d.setCcLast4,
    ccCreditLimit: d.ccCreditLimit,
    setCcCreditLimit: d.setCcCreditLimit,
    ccPaymentDueDay: d.ccPaymentDueDay,
    setCcPaymentDueDay: d.setCcPaymentDueDay,
    ccGraceDays: d.ccGraceDays,
    setCcGraceDays: d.setCcGraceDays,
    ccMinPercent: d.ccMinPercent,
    setCcMinPercent: d.setCcMinPercent,
    creditCardDebts: d.creditCardDebts,
    installmentProvider: d.installmentProvider,
    setInstallmentProvider: d.setInstallmentProvider,
    linkedCreditCardDebtId: d.linkedCreditCardDebtId,
    setLinkedCreditCardDebtId: d.setLinkedCreditCardDebtId,
    installmentItemName: d.installmentItemName,
    setInstallmentItemName: d.setInstallmentItemName,
    installmentCount: d.installmentCount,
    setInstallmentCount: d.setInstallmentCount,
    installmentFrequency: d.installmentFrequency,
    setInstallmentFrequency: d.setInstallmentFrequency,
    installmentStartDate: d.installmentStartDate,
    setInstallmentStartDate: d.setInstallmentStartDate,
    installmentPreview: d.installmentPreview,
  } as const

  return (
    <ModalShell open={d.isOpen} onBackdropClick={d.closeSheet}>
      <div className={`${MODAL_SHEET_OUTER_CLASS} p-5`}>
        <div className="shrink-0">
          <AddDebtSheetHeader title={title} onClose={d.closeSheet} />
        </div>
        {d.isPayDebtFlow ?
          d.payDebtStep === 'select' ?
            <PayDebtSelectList debts={d.payableDebts} onSelect={d.selectDebtForPayFlow} />
          : <AddDebtPaymentForm
              {...paymentFormProps}
              hideDebtSelect
              onBackToDebtList={d.backToPayDebtList}
            />
        : d.debtSheetPaymentOnly ?
          <AddDebtPaymentForm {...paymentFormProps} />
        : <>
            <AddDebtNewForm {...newDebtSharedProps} />
            <AddDebtNewFormFooter
              isCreditCard={d.debtType === 'credit_card'}
              canSubmit={d.canSubmitNewDebt}
              onSubmit={d.handleAddDebt}
            />
          </>
        }
      </div>
    </ModalShell>
  )
}
