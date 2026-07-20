'use client'

import { AddDebtDebtTypeSection } from '@/components/features/debts/AddDebtDebtTypeSection'
import { AddDebtNewFormAmountBlock } from '@/components/features/debts/AddDebtNewFormAmountBlock'
import { AddDebtNewFormPersonDesc } from '@/components/features/debts/AddDebtNewFormPersonDesc'
import { CreditCardForm } from '@/components/features/debts/CreditCardForm'
import type { AddDebtNewFormProps } from '@/components/features/debts/addDebtNewForm.types'
export type { AddDebtNewFormProps } from '@/components/features/debts/addDebtNewForm.types'

/** Fields for creating a new debt (fiat or gold) with debt-type sections. */
export function AddDebtNewForm(props: AddDebtNewFormProps) {
  const isCreditCard = props.debtType === 'credit_card'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
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
        installmentProviderName={props.installmentProviderName}
        setInstallmentProviderName={props.setInstallmentProviderName}
        installmentProviderSlug={props.installmentProviderSlug}
        setInstallmentProviderSlug={props.setInstallmentProviderSlug}
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
    </div>
  )
}
