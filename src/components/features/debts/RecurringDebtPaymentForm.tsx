'use client'

import { useMemo } from 'react'
import { AmountField } from '@/components/ui/AmountField'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import type { Debt, DebtRecurringFrequency, PaymentMethod } from '@/lib/store/types'
import { RECURRING_DEBT_FREQUENCIES } from '@/lib/constants/debtRecurring'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { useT } from '@/lib/i18n'

export interface RecurringDebtPaymentFormProps {
  payableDebts: Debt[]
  selectDebtValue: string
  onDebtChange: (id: string) => void
  amount: string
  onAmountChange: (v: string) => void
  paymentCurrency: string
  onPaymentCurrencyChange: (v: string) => void
  fiatOptions: { value: string; disabled?: boolean }[]
  selectedDebt: Debt | undefined
  error: string | null
  previewLine: string | null
  frequency: DebtRecurringFrequency
  onFrequencyChange: (f: DebtRecurringFrequency) => void
  nextDueDate: string
  onNextDueDateChange: (v: string) => void
  paymentMethods: PaymentMethod[]
  paymentMethodId: string
  onPaymentMethodChange: (id: string) => void
  isActive: boolean
  onIsActiveChange: (v: boolean) => void
  notes: string
  onNotesChange: (v: string) => void
  onCancel: () => void
  onSubmit: () => void
}

export function RecurringDebtPaymentForm({
  payableDebts,
  selectDebtValue,
  onDebtChange,
  amount,
  onAmountChange,
  paymentCurrency,
  onPaymentCurrencyChange,
  selectedDebt,
  error,
  previewLine,
  frequency,
  onFrequencyChange,
  nextDueDate,
  onNextDueDateChange,
  paymentMethods,
  paymentMethodId,
  onPaymentMethodChange,
  isActive,
  onIsActiveChange,
  notes,
  onNotesChange,
  onCancel,
  onSubmit,
}: RecurringDebtPaymentFormProps) {
  const t = useT()

  const debtItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () =>
      payableDebts.map((d) => ({
        value: d.id,
        label: `${d.name} (${d.isGold ? `${d.goldKarat}K gold` : d.currency})`,
      })),
    [payableDebts],
  )
  const freqItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () => RECURRING_DEBT_FREQUENCIES.map((f) => ({ value: f.value, label: f.label })),
    [],
  )

  if (payableDebts.length === 0) {
    return (
      <p className="text-sm text-[var(--color-brand-text-muted)]">
        {t.recurringDebt.emptyNoBalances}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.recurringDebt.labelBalance}</Label>
        <SelectField
          value={selectDebtValue}
          onChange={onDebtChange}
          items={debtItems}
          className="mt-1"
          aria-label={t.recurringDebt.labelBalance}
        />
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.recurringDebt.labelAmount}</Label>
        <div className="grid grid-cols-2 gap-3 mt-1">
          <AmountField
            placeholder={t.recurringDebt.placeholderAmount}
            value={amount}
            onChange={onAmountChange}
            className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
          />
          <CurrencyField
            value={paymentCurrency}
            onChange={onPaymentCurrencyChange}
            includeGold={!!selectedDebt?.isGold}
            className="w-full h-11 px-3 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]"
          />
        </div>
      </div>

      {error ? <p className="text-xs text-[var(--color-brand-red)]">{error}</p> : null}
      {previewLine ? <p className="text-xs text-[var(--color-brand-text-secondary)]">{previewLine}</p> : null}

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.recurringDebt.labelFrequency}</Label>
        <SelectField
          value={frequency}
          onChange={(v) => onFrequencyChange(v as DebtRecurringFrequency)}
          items={freqItems}
          className="mt-1"
          aria-label={t.recurringDebt.labelFrequency}
        />
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.recurringDebt.labelNextDue}</Label>
        <DatePickerField value={nextDueDate} onChange={onNextDueDateChange} className="mt-1" />
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-2 block">{t.recurringDebt.labelPaidVia}</Label>
        <PaymentMethodPicker
          value={paymentMethodId}
          onChange={onPaymentMethodChange}
          paymentMethods={paymentMethods}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.recurringDebt.labelActive}</Label>
        <Switch checked={isActive} onCheckedChange={onIsActiveChange} />
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.recurringDebt.labelNotes}</Label>
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] min-h-12"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)]"
        >
          {t.common.cancel}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!selectDebtValue || !amount || payableDebts.length === 0}
          className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] text-white text-sm font-semibold disabled:opacity-50"
        >
          {t.recurringDebt.buttonSubmit}
        </button>
      </div>
    </div>
  )
}
