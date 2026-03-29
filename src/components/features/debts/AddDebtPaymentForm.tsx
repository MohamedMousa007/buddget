'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { buildFiatCurrencyPickerOptions } from '@/lib/utils/currencyPickerOptions'
import type { AppSettings, Debt, PaymentMethod } from '@/lib/store/types'

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
}: AddDebtPaymentFormProps) {
  if (payableDebts.length === 0) {
    return (
      <p className="text-sm text-[var(--color-brand-text-muted)] py-2">
        All balances are cleared. You can track a new balance or edit an existing one.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">Select balance</Label>
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
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">Date</Label>
        <Input
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Amount Paid</Label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={paymentAmount}
            onChange={(e) => {
              setPaymentAmount(e.target.value)
            }}
            className="mt-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-white font-mono-numbers"
          />
        </div>
        <div>
          <Label className="text-xs text-[var(--color-brand-text-secondary)]">Payment Currency</Label>
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
            {selectedDebt?.isGold ? <option value="XAU">Gold (grams)</option> : null}
          </select>
        </div>
      </div>
      {paymentRateError ? <p className="text-xs text-[var(--color-brand-red)] px-1">{paymentRateError}</p> : null}
      {paymentPreviewText ? (
        <p className="text-xs text-[var(--color-brand-gold)] px-1">{paymentPreviewText}</p>
      ) : null}
      <div>
        <Label className="text-xs text-[var(--color-brand-text-secondary)] mb-2 block">Paid via</Label>
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
        <Label className="text-xs text-[var(--color-brand-text-secondary)]">Any notes?</Label>
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
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!selectedDebtId || !paymentAmount}
          className="flex-1 py-3 rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          Log payment →
        </button>
      </div>
    </div>
  )
}
