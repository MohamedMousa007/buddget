'use client'

import { useEscapeClose } from '@/hooks/useEscapeClose'
import { useAddDebtSheet } from '@/hooks/useAddDebtSheet'
import { ModalShell } from '@/components/modals/ModalShell'
import { AddDebtSheetHeader } from '@/components/features/debts/AddDebtSheetHeader'
import { AddDebtModeTabs } from '@/components/features/debts/AddDebtModeTabs'
import { AddDebtNewForm } from '@/components/features/debts/AddDebtNewForm'
import { AddDebtPaymentForm } from '@/components/features/debts/AddDebtPaymentForm'
import { PayDebtSelectList } from '@/components/features/debts/PayDebtSelectList'
import { DebtGoalSheet } from '@/components/features/debts/DebtGoalSheet'
import { useT } from '@/lib/i18n'

/**
 * Bottom sheet: create debt or record payment. Logic in `useAddDebtSheet`.
 */
export function AddDebtSheet() {
  const d = useAddDebtSheet()
  const t = useT()
  useEscapeClose(d.isOpen, d.closeSheet)

  const title = d.isPayDebtFlow
    ? t.addDebt.titlePayDebt
    : d.debtSheetPaymentOnly
      ? t.addDebt.titlePayment
      : d.mode === 'new'
        ? t.addDebt.titleNew
        : t.addDebt.titlePayment

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

  const goalTitle =
    d.debtType === 'installment' ? d.installmentItemName || t.addDebt.labelItemName : d.name || t.addDebt.labelName

  return (
    <>
      <ModalShell open={d.isOpen} onBackdropClick={d.closeSheet}>
        <div className="p-6">
          <AddDebtSheetHeader title={title} onClose={d.closeSheet} />
          {d.isPayDebtFlow ? (
            d.payDebtStep === 'select' ? (
              <PayDebtSelectList debts={d.payableDebts} onSelect={d.selectDebtForPayFlow} />
            ) : (
              <AddDebtPaymentForm
                {...paymentFormProps}
                hideDebtSelect
                onBackToDebtList={d.backToPayDebtList}
              />
            )
          ) : d.debtSheetPaymentOnly ? (
            <AddDebtPaymentForm {...paymentFormProps} />
          ) : (
            <>
              <AddDebtModeTabs mode={d.mode} onModeChange={d.setMode} />
              {d.mode === 'new' ? (
                <AddDebtNewForm
                  settings={d.settings}
                  debtType={d.debtType}
                  setDebtType={d.setDebtType}
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
                  relationship={d.relationship}
                  setRelationship={d.setRelationship}
                  direction={d.direction}
                  setDirection={d.setDirection}
                  creditor={d.creditor}
                  setCreditor={d.setCreditor}
                  installmentItemName={d.installmentItemName}
                  setInstallmentItemName={d.setInstallmentItemName}
                  installmentCount={d.installmentCount}
                  setInstallmentCount={d.setInstallmentCount}
                  installmentFrequency={d.installmentFrequency}
                  setInstallmentFrequency={d.setInstallmentFrequency}
                  installmentStartDate={d.installmentStartDate}
                  setInstallmentStartDate={d.setInstallmentStartDate}
                  interestFree={d.interestFree}
                  setInterestFree={d.setInterestFree}
                  installmentPreview={d.installmentPreview}
                  goalDraft={d.goalDraft}
                  onOpenGoal={() => d.setGoalSheetOpen(true)}
                  onClearGoal={() => {
                    d.setGoalDraft(null)
                    d.setGoalRemindRecurring(false)
                  }}
                  onCancel={d.closeSheet}
                  onSubmit={d.handleAddDebt}
                  canSubmit={d.canSubmitNewDebt}
                />
              ) : (
                <AddDebtPaymentForm {...paymentFormProps} />
              )}
            </>
          )}
        </div>
      </ModalShell>

      <DebtGoalSheet
        open={d.goalSheetOpen}
        onClose={() => d.setGoalSheetOpen(false)}
        debtTitle={goalTitle}
        remainingAmount={Math.max(0, parseFloat(d.startingBalance) || 0)}
        currency={String(d.currency)}
        initialGoal={d.goalDraft}
        onSave={(goal, remind) => {
          d.setGoalDraft(goal)
          d.setGoalRemindRecurring(remind)
        }}
      />
    </>
  )
}
