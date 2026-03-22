'use client'

import { formatCurrency } from '@/lib/utils/formatters'
import { convertCurrency } from '@/lib/utils/currency'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency } from '@/lib/store/types'

type Variant = 'card' | 'table' | 'inline'

interface MoneyDisplayProps {
  amount: number
  currency: Currency | string
  amountInPrimary?: number
  variant?: Variant
  className?: string
  primaryClassName?: string
  secondaryClassName?: string
}

export function MoneyDisplay({
  amount,
  currency,
  amountInPrimary,
  variant = 'inline',
  className = '',
  primaryClassName = '',
  secondaryClassName = '',
}: MoneyDisplayProps) {
  const { settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({ settings: s.settings, exchangeRates: s.exchangeRates }))
  )
  const base = settings.baseCurrency
  const secondary = settings.secondaryCurrency
  const showSecondary = settings.showSecondaryCurrency && secondary

  const primaryAmount =
    amountInPrimary != null
      ? amountInPrimary
      : currency === base
        ? amount
        : convertCurrency(amount, currency, base, exchangeRates)

  const secondaryAmount = showSecondary && secondary
    ? convertCurrency(primaryAmount, base, secondary, exchangeRates)
    : null

  if (variant === 'card') {
    return (
      <span className={`${className}`}>
        <span className={`font-mono-numbers ${primaryClassName}`}>
          {formatCurrency(primaryAmount, base)}
        </span>
        {secondaryAmount != null && secondary && (
          <span className={`text-xs text-[var(--color-brand-text-muted)] ml-1.5 ${secondaryClassName}`}>
            ({formatCurrency(secondaryAmount, secondary)})
          </span>
        )}
      </span>
    )
  }

  if (variant === 'table') {
    const isOriginalDifferent = currency !== base
    return (
      <span className={`${className}`}>
        <span className={`font-mono-numbers ${primaryClassName}`}>
          {isOriginalDifferent
            ? formatCurrency(amount, currency)
            : formatCurrency(primaryAmount, base)}
        </span>
        {isOriginalDifferent && (
          <span className={`block text-[10px] text-[var(--color-brand-text-muted)] ${secondaryClassName}`}>
            {formatCurrency(primaryAmount, base)}
          </span>
        )}
      </span>
    )
  }

  return (
    <span className={`font-mono-numbers ${className} ${primaryClassName}`}>
      {formatCurrency(primaryAmount, base)}
    </span>
  )
}
