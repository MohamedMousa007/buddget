'use client'

import { useMemo } from 'react'
import { CURRENCY_INFO } from '@/components/features/settings/currencyConverterConstants'
import { SelectField, type SelectFieldOption } from '@/components/ui/SelectField'
import { AmountField } from '@/components/ui/AmountField'

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
  const items = useMemo<ReadonlyArray<SelectFieldOption>>(
    () =>
      availableCurrencies.map((c) => ({
        value: c,
        label: `${CURRENCY_INFO[c]?.flag ?? ''} ${c}`.trim(),
      })),
    [availableCurrencies],
  )

  return (
    <div className="relative">
      {variant === 'result' ? (
        <div className="w-full h-12 px-4 pr-28 rounded-xl bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] flex items-center">
          <span className="text-lg font-mono-numbers text-[var(--color-brand-text-primary)]">{amount}</span>
        </div>
      ) : (
        <AmountField
          value={amount}
          onChange={(v) => onAmountChange?.(v)}
          placeholder="0.00"
          className="w-full h-12 px-4 pr-28 rounded-xl bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] text-lg font-mono-numbers"
        />
      )}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 w-24">
        <SelectField value={currency} onChange={onCurrencyChange} items={items} />
      </div>
    </div>
  )
}
