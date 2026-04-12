'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { buildFiatCurrencyPickerOptions } from '@/lib/utils/currencyPickerOptions'
import { RECURRING_DEBT_FREQUENCIES } from '@/lib/constants/debtRecurring'
import type { AppSettings, Debt, DebtRecurringFrequency, PaymentMethod } from '@/lib/store/types'
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
  settings,
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
            <p className="mt-1 text-sm font-medium text-white truncate">{selectedDebt.name}</p>
          </div>
          {onBackToDebtList ? (
            <button
              type="button"
              onClick={onBackToDebtList}
              className="text-sm text-[var(--color-brand-gold)] hover:underline shrink-0 pt-5"
            >
              {t.addDebtPayment.backDebtList}
            </button>
          ) : null}
        </div>
      ) : (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebtPayment.labelDebt}</Label>
          <select
            value={selectedPayable ? selectedDebtId : payableDebts[0]?.id ?? ''}
            onChange={(e) => setSelectedDebtId(e.target.value)}
            className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
          >
            {payableDebts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.isGold ? `(${d.goldKarat}K Gold)` : `(${d.currency})`}
              </option>
            ))}
          </select>
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
        <Input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
        />
      </div>

      {paymentScheduleMode === 'recurring' ? (
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">
            {t.addDebtPayment.labelRecurringFrequency}
          </Label>
          <select
            value={recurringFrequency}
            onChange={(e) => setRecurringFrequency(e.target.value as DebtRecurringFrequency)}
            className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
          >
            {RECURRING_DEBT_FREQUENCIES.filter((f) => f.value !== 'biweekly').map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebtPayment.labelAmountPaid}</Label>
          <Input
            type="number"
            step="0.01"
            placeholder={t.addDebtPayment.placeholderAmount}
            value={paymentAmount}
            onChange={(e) => {
              setPaymentAmount(e.target.value)
            }}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebtPayment.labelPaymentCurrency}</Label>
          <select
            value={paymentCurrency}
            onChange={(e) => setPaymentCurrency(e.target.value)}
            className="mt-1 w-full h-9 px-3 rounded-md bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
          >
            {buildFiatCurrencyPickerOptions(settings).map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.value}
              </option>
            ))}
            {selectedDebt?.isGold ? <option value="XAU">{t.addDebtPayment.optionGoldGrams}</option> : null}
          </select>
        </div>
      </div>
      {paymentRateError ? <p className="text-xs text-[var(--color-brand-red)] px-1">{paymentRateError}</p> : null}
      {paymentPreviewText ? (
        <p className="text-xs text-[var(--color-brand-gold)] px-1">{paymentPreviewText}</p>
      ) : null}
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-2 block">{t.addDebtPayment.labelPaidVia}</Label>
        <div className="flex flex-wrap gap-2">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => setPaymentMethodId(method.id)}
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
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.addDebtPayment.labelNotes}</Label>
        <Textarea
          value={paymentNotes}
          onChange={(e) => setPaymentNotes(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white min-h-[60px]"
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
