'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import type { Debt, DebtRecurringFrequency } from '@/lib/store/types'
import { RECURRING_DEBT_FREQUENCIES } from '@/lib/constants/debtRecurring'
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
        <select
          value={selectDebtValue}
          onChange={(e) => onDebtChange(e.target.value)}
          className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
        >
          {payableDebts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.isGold ? `${d.goldKarat}K gold` : d.currency})
            </option>
          ))}
        </select>
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
            className="bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
          />
          <select
            value={paymentCurrency}
            onChange={(e) => onPaymentCurrencyChange(e.target.value)}
            className="w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
          >
            {fiatOptions.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.value}
              </option>
            ))}
            {selectedDebt?.isGold ? <option value="XAU">{t.addDebtPayment.optionGoldGrams}</option> : null}
          </select>
        </div>
      </div>

      {error ? <p className="text-xs text-[var(--color-brand-red)]">{error}</p> : null}
      {previewLine ? <p className="text-xs text-[var(--color-brand-text-secondary)]">{previewLine}</p> : null}

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.recurringDebt.labelFrequency}</Label>
        <select
          value={frequency}
          onChange={(e) => onFrequencyChange(e.target.value as DebtRecurringFrequency)}
          className="mt-1 w-full h-8 px-3 rounded-lg bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-white text-sm"
        >
          {RECURRING_DEBT_FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">{t.recurringDebt.labelNextDue}</Label>
        <Input
          type="date"
          value={nextDueDate}
          onChange={(e) => onNextDueDateChange(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
        />
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
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white min-h-[50px]"
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
