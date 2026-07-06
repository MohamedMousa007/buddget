'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import type { Debt, DebtRecurringFrequency } from '@/lib/store/types'
import { RECURRING_DEBT_FREQUENCIES } from '@/lib/constants/debtRecurring'
import { DatePickerField } from '@/components/ui/DatePickerField'
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
  paymentMethods: { id: string; name: string }[]
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
  fiatOptions,
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
  const currencyItems = useMemo<ReadonlyArray<SelectFieldOption>>(() => {
    const base = fiatOptions.map<SelectFieldOption>((o) => ({
      value: o.value,
      label: o.value,
      disabled: o.disabled,
    }))
    return selectedDebt?.isGold
      ? [...base, { value: 'XAU', label: t.addDebtPayment.optionGoldGrams }]
      : base
  }, [fiatOptions, selectedDebt?.isGold, t.addDebtPayment.optionGoldGrams])
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
          <Input
            type="number"
            step="0.01"
            placeholder={t.recurringDebt.placeholderAmount}
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
          />
          <SelectField
            value={paymentCurrency}
            onChange={onPaymentCurrencyChange}
            items={currencyItems}
            aria-label={t.recurringDebt.labelAmount}
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
        <div className="flex flex-wrap gap-2">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => onPaymentMethodChange(method.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                paymentMethodId === method.id
                  ? 'bg-[var(--color-brand-red)] text-white'
                  : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)]'
              }`}
            >
              {method.name}
            </button>
          ))}
        </div>
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
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] min-h-[50px]"
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
