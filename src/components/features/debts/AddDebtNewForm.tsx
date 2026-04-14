'use client'

import { AddDebtDebtTypeSection } from '@/components/features/debts/AddDebtDebtTypeSection'
import { AddDebtNewFormAmountBlock } from '@/components/features/debts/AddDebtNewFormAmountBlock'
import { AddDebtNewFormGoalBlock } from '@/components/features/debts/AddDebtNewFormGoalBlock'
import { AddDebtNewFormPersonDesc } from '@/components/features/debts/AddDebtNewFormPersonDesc'
import { AddDebtNewFormFooter } from '@/components/features/debts/AddDebtNewFormFooter'
import { CreditCardForm } from '@/components/features/debts/CreditCardForm'
import type { AddDebtNewFormProps } from '@/components/features/debts/addDebtNewForm.types'
export type { AddDebtNewFormProps } from '@/components/features/debts/addDebtNewForm.types'
/** Fields for creating a new debt (fiat or gold) with debt-type sections. */
export function AddDebtNewForm(props: AddDebtNewFormProps) {
  const isCreditCard = props.debtType === 'credit_card'

  return (
    <div className="space-y-4">
      <AddDebtDebtTypeSection
        debtType={props.debtType}
        setDebtType={props.setDebtType}
        installmentItemName={props.installmentItemName}
        setInstallmentItemName={props.setInstallmentItemName}
        installmentCount={props.installmentCount}
        setInstallmentCount={props.setInstallmentCount}
        installmentFrequency={props.installmentFrequency}
        setInstallmentFrequency={props.setInstallmentFrequency}
        installmentStartDate={props.installmentStartDate}
        setInstallmentStartDate={props.setInstallmentStartDate}
        installmentProvider={props.installmentProvider}
        setInstallmentProvider={props.setInstallmentProvider}
        linkedCreditCardDebtId={props.linkedCreditCardDebtId}
        setLinkedCreditCardDebtId={props.setLinkedCreditCardDebtId}
        creditCardDebts={props.creditCardDebts}
        relationship={props.relationship}
        setRelationship={props.setRelationship}
        direction={props.direction}
        setDirection={props.setDirection}
        creditor={props.creditor}
        setCreditor={props.setCreditor}
      />

      {isCreditCard ? (
        <CreditCardForm
          name={props.name}
          setName={props.setName}
          last4={props.ccLast4}
          setLast4={props.setCcLast4}
          creditLimit={props.ccCreditLimit}
          setCreditLimit={props.setCcCreditLimit}
          outstanding={props.startingBalance}
          setOutstanding={props.setStartingBalance}
          currency={props.currency}
          setCurrency={props.setCurrency}
          paymentDueDay={props.ccPaymentDueDay}
          setPaymentDueDay={props.setCcPaymentDueDay}
          graceDays={props.ccGraceDays}
          setGraceDays={props.setCcGraceDays}
          minPercent={props.ccMinPercent}
          setMinPercent={props.setCcMinPercent}
        />
      ) : null}

      <AddDebtNewFormPersonDesc
        debtType={props.debtType}
        name={props.name}
        setName={props.setName}
        person={props.person}
        setPerson={props.setPerson}
        description={props.description}
        setDescription={props.setDescription}
      />

      <AddDebtNewFormAmountBlock
        debtType={props.debtType}
        receivedVia={props.receivedVia}
        onReceivedViaChange={props.onReceivedViaChange}
        startingBalance={props.startingBalance}
        setStartingBalance={props.setStartingBalance}
        currency={props.currency}
        setCurrency={props.setCurrency}
        goldKarat={props.goldKarat}
        setGoldKarat={props.setGoldKarat}
        installmentPreview={props.installmentPreview}
      />

      <AddDebtNewFormGoalBlock
        debtType={props.debtType}
        currency={props.currency}
        goalDraft={props.goalDraft}
        onOpenGoal={props.onOpenGoal}
        onClearGoal={props.onClearGoal}
      />

      <AddDebtNewFormFooter
        isCreditCard={isCreditCard}
        canSubmit={props.canSubmit}
        onCancel={props.onCancel}
        onSubmit={props.onSubmit}
      />
    </div>
  )
}
