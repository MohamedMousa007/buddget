'use client'

import { useMemo } from 'react'
import { AmountField } from '@/components/ui/AmountField'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import { RECURRING_DEBT_FREQUENCIES } from '@/lib/constants/debtRecurring'
import type { AppSettings, Debt, DebtRecurringFrequency, PaymentMethod } from '@/lib/store/types'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { CurrencyField } from '@/components/ui/CurrencyField'
import { PaymentMethodPicker } from '@/components/features/payments/PaymentMethodPicker'
import { useT } from '@/lib/i18n'

export interface AddDebtPaymentFormProps {
  settings: AppSettings
  payableDebts: Debt[]
  selectedDebtId: string
  setSelectedDebtId: (id: string) => void
  selectedDebt: Debt | undefined
  selectedPayable: Debt | undefined
  paymentDate: string
  setPaymentDate: (v: string) => void
  paymentAmount: string
  setPaymentAmount: (v: string) => void
  paymentCurrency: string
  setPaymentCurrency: (v: string) => void
  paymentRateError: string
  paymentPreviewText: string | null
  paymentMethods: PaymentMethod[]
  paymentMethodId: string
  setPaymentMethodId: (id: string) => void
  paymentNotes: string
  setPaymentNotes: (v: string) => void
  onCancel: () => void
  onSubmit: () => void
  /** When set, debt was chosen in a prior step (e.g. Pay a debt flow). */
  hideDebtSelect?: boolean
  onBackToDebtList?: () => void
  paymentScheduleMode: 'one_time' | 'recurring'
  setPaymentScheduleMode: (m: 'one_time' | 'recurring') => void
  recurringFrequency: DebtRecurringFrequency
  setRecurringFrequency: (f: DebtRecurringFrequency) => void
}

/**
 * Record a payment against an existing debt.
 */
export function AddDebtPaymentForm({
  payableDebts,
  selectedDebtId,
  setSelectedDebtId,
  selectedDebt,
  selectedPayable,
  paymentDate,
  setPaymentDate,
  paymentAmount,
  setPaymentAmount,
  paymentCurrency,
  setPaymentCurrency,
  paymentRateError,
  paymentPreviewText,
  paymentMethods,
  paymentMethodId,
  setPaymentMethodId,
  paymentNotes,
  setPaymentNotes,
  onCancel,
  onSubmit,
  hideDebtSelect = false,
  onBackToDebtList,
  paymentScheduleMode,
  setPaymentScheduleMode,
  recurringFrequency,
  setRecurringFrequency,
}: AddDebtPaymentFormProps) {
  const t = useT()

  const debtItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () =>
      payableDebts.map((d) => ({
        value: d.id,
        label: `${d.name} ${d.isGold ? `(${d.goldKarat}K Gold)` : `(${d.currency})`}`,
      })),
    [payableDebts],
  )
  const freqItems = useMemo<ReadonlyArray<SelectFieldOption>>(
    () =>
      RECURRING_DEBT_FREQUENCIES.filter((f) => f.value !== 'biweekly').map((f) => ({
        value: f.value,
        label: f.label,
      })),
    [],
  )

  if (payableDebts.length === 0) {
    return (
      <p className="text-sm text-[var(--color-brand-text-muted)] py-2">
        {t.addDebtPayment.allCleared}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {hideDebtSelect && selectedDebt ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebtPayment.labelDebt}</Label>
            <p className="mt-1 text-sm font-medium text-[var(--color-brand-text-primary)] truncate">{selectedDebt.name}</p>
          </div>
          {onBackToDebtList ? (
            <button
              type="button"
              onClick={onBackToDebtList}
              className="text-sm px-3 py-1.5 rounded-lg border border-[var(--color-brand-border)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors shrink-0 mt-5"
            >
              {t.addDebtPayment.backDebtList}
            </button>
          ) : null}
        </div>
      ) : (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebtPayment.labelDebt}</Label>
          <SelectField
            value={selectedPayable ? selectedDebtId : payableDebts[0]?.id ?? ''}
            onChange={setSelectedDebtId}
            items={debtItems}
            className="mt-1"
            aria-label={t.addDebtPayment.labelDebt}
          />
        </div>
      )}
      <div className="flex rounded-xl border border-[var(--color-brand-border)] p-1 gap-1">
        <button
          type="button"
          onClick={() => setPaymentScheduleMode('one_time')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
            paymentScheduleMode === 'one_time'
              ? 'bg-[var(--color-brand-red)] text-white'
              : 'text-[var(--color-brand-text-secondary)]'
          }`}
        >
          {t.addDebtPayment.paymentModeOneTime}
        </button>
        <button
          type="button"
          onClick={() => setPaymentScheduleMode('recurring')}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
            paymentScheduleMode === 'recurring'
              ? 'bg-[var(--color-brand-red)] text-white'
              : 'text-[var(--color-brand-text-secondary)]'
          }`}
        >
          {t.addDebtPayment.paymentModeRecurring}
        </button>
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebtPayment.labelDate}</Label>
        <DatePickerField value={paymentDate} onChange={setPaymentDate} className="mt-1" />
      </div>

      {paymentScheduleMode === 'recurring' ? (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            {t.addDebtPayment.labelRecurringFrequency}
          </Label>
          <SelectField
            value={recurringFrequency}
            onChange={(v) => setRecurringFrequency(v as DebtRecurringFrequency)}
            items={freqItems}
            className="mt-1"
            aria-label={t.addDebtPayment.labelRecurringFrequency}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebtPayment.labelAmountPaid}</Label>
          <AmountField
            placeholder={t.addDebtPayment.placeholderAmount}
            value={paymentAmount}
            onChange={setPaymentAmount}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] font-mono-numbers"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebtPayment.labelPaymentCurrency}</Label>
          <CurrencyField
            value={paymentCurrency}
            onChange={setPaymentCurrency}
            includeGold={!!selectedDebt?.isGold}
            className="mt-1 w-full h-11 px-3 rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]"
          />
        </div>
      </div>
      {paymentRateError ? <p className="text-xs text-[var(--color-brand-red)] px-1">{paymentRateError}</p> : null}
      {paymentPreviewText ? (
        <p className="text-xs text-[var(--color-brand-text-secondary)] px-1">{paymentPreviewText}</p>
      ) : null}
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-2 block">{t.addDebtPayment.labelPaidVia}</Label>
        <PaymentMethodPicker
          value={paymentMethodId}
          onChange={setPaymentMethodId}
          paymentMethods={paymentMethods}
        />
      </div>
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebtPayment.labelNotes}</Label>
        <Textarea
          value={paymentNotes}
          onChange={(e) => setPaymentNotes(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] min-h-16"
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl border border-[var(--color-brand-border)] text-sm text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
        >
          {t.common.cancel}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!selectedDebtId || !paymentAmount}
          className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {paymentScheduleMode === 'recurring' ? t.recurringDebt.buttonSubmit : t.addDebtPayment.buttonSubmit}
        </button>
      </div>
    </div>
  )
}
