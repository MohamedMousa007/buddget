'use client'

import { CURRENCY_INFO } from '@/components/features/settings/currencyConverterConstants'

/** Single row: optional read-only numeric display, or editable amount + currency select. */
export function CurrencyConverterAmountBlock({
  variant,
  amount,
  onAmountChange,
  currency,
  onCurrencyChange,
  availableCurrencies,
}: {
  variant: 'input' | 'result'
  amount: string
  onAmountChange?: (v: string) => void
  currency: string
  onCurrencyChange: (v: string) => void
  availableCurrencies: readonly string[]
}) {
  return (
    <div className="relative">
      {variant === 'result' ? (
        <div className="w-full h-12 px-4 pr-24 rounded-xl bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] flex items-center">
          <span className="text-lg font-mono-numbers text-[var(--color-brand-text-primary)]">{amount}</span>
        </div>
      ) : (
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => onAmountChange?.(e.target.value)}
          className="w-full h-12 px-4 pr-24 rounded-xl bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-lg font-mono-numbers focus:outline-none focus:border-[var(--color-brand-red)]"
          placeholder="0.00"
        />
      )}
      <select
        value={currency}
        onChange={(e) => onCurrencyChange(e.target.value)}
        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-2 rounded-lg bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] text-sm font-medium text-[var(--color-brand-text-primary)]"
      >
        {availableCurrencies.map((c) => (
          <option key={c} value={c}>
            {CURRENCY_INFO[c]?.flag ?? ''} {c}
          </option>
        ))}
      </select>
    </div>
  )
}
