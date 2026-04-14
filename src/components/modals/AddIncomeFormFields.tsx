'use client'

import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AddIncomeRecurringSection } from '@/components/modals/AddIncomeRecurringSection'
import { AddIncomeTypeAndAmount } from '@/components/modals/AddIncomeTypeAndAmount'
import { AddIncomeNotesField } from '@/components/modals/AddIncomeNotesField'
import type { Dictionary } from '@/lib/i18n/types'
import type { Currency, IncomeRecurringFrequency, IncomeSourceType } from '@/lib/store/types'
import type { PaymentMethod } from '@/lib/store/types'

export type AddIncomeFormFieldsProps = {
  t: Dictionary
  name: string
  setName: (v: string) => void
  amount: string
  setAmount: (v: string) => void
  currency: Currency
  setCurrency: (v: Currency) => void
  paymentMethods: PaymentMethod[]
  paymentMethodId: string
  setPaymentMethodId: (id: string) => void
  sourceType: IncomeSourceType
  onSourceTypeChange: (st: IncomeSourceType) => void
  isRecurring: boolean
  setIsRecurring: (v: boolean) => void
  recurringFrequency: IncomeRecurringFrequency
  setRecurringFrequency: (v: IncomeRecurringFrequency) => void
  dayOfMonth: string
  setDayOfMonth: (v: string) => void
  notes: string
  setNotes: (v: string) => void
  debtSection?: ReactNode
}

/** Fields for the add-income sheet. */
export function AddIncomeFormFields(props: AddIncomeFormFieldsProps) {
  const {
    t,
    name,
    setName,
    amount,
    setAmount,
    currency,
    setCurrency,
    paymentMethods,
    paymentMethodId,
    setPaymentMethodId,
    sourceType,
    onSourceTypeChange,
    isRecurring,
    setIsRecurring,
    recurringFrequency,
    setRecurringFrequency,
    dayOfMonth,
    setDayOfMonth,
    notes,
    setNotes,
    debtSection,
  } = props

  return (
    <div className="space-y-4">
      <AddIncomeTypeAndAmount
        t={t}
        name={name}
        setName={setName}
        amount={amount}
        setAmount={setAmount}
        currency={currency}
        setCurrency={setCurrency}
        paymentMethods={paymentMethods}
        paymentMethodId={paymentMethodId}
        setPaymentMethodId={setPaymentMethodId}
        sourceType={sourceType}
        onSourceTypeChange={onSourceTypeChange}
      />
      {sourceType === 'debt' ? debtSection : null}
      <div className="flex items-center justify-between">
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addIncome.labelRecurring}</Label>
        <Switch checked={isRecurring} onCheckedChange={setIsRecurring} disabled={sourceType === 'debt'} />
      </div>
      {isRecurring ? (
        <AddIncomeRecurringSection
          t={t}
          recurringFrequency={recurringFrequency}
          setRecurringFrequency={setRecurringFrequency}
          dayOfMonth={dayOfMonth}
          setDayOfMonth={setDayOfMonth}
        />
      ) : null}
      <AddIncomeNotesField t={t} notes={notes} setNotes={setNotes} />
    </div>
  )
}
