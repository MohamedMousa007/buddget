'use client'

import { formatCurrency } from '@/lib/utils/formatters'
import type { SavingsAccount } from '@/lib/store/types'
import { savingsAccountConversionAmounts } from '@/lib/savings/savingsConversions'
import type { AppSettings } from '@/lib/store/types'

export function SavingsCardConversionLine({
  account,
  settings,
  exchangeRates,
  goldPriceAvailable,
  liveCryptoLabel,
  liveStocksLabel,
  goldAedUnavailableLabel,
}: {
  account: SavingsAccount
  settings: AppSettings
  exchangeRates: Record<string, number>
  goldPriceAvailable: boolean
  liveCryptoLabel: string
  liveStocksLabel: string
  goldAedUnavailableLabel: string
}) {
  if (account.currency === 'XAU' && !goldPriceAvailable) {
    return (
      <p className="text-[11px] text-[var(--color-brand-text-muted)] italic">({goldAedUnavailableLabel})</p>
    )
  }

  const primary = settings.baseCurrency
  const secondary = settings.showSecondaryCurrency ? settings.secondaryCurrency : null
  const { primary: pAmt, secondary: sAmt, needsPlaceholder } = savingsAccountConversionAmounts(
    account,
    primary,
    secondary,
    settings.showSecondaryCurrency,
    exchangeRates
  )

  if (needsPlaceholder) {
    const msg = account.type === 'stocks' ? liveStocksLabel : liveCryptoLabel
    return (
      <p className="text-[11px] text-[var(--color-brand-text-muted)] font-mono-numbers">({msg})</p>
    )
  }

  const parts: string[] = []
  if (pAmt != null && account.currency !== primary) {
    parts.push(formatCurrency(pAmt, primary, true))
  }
  if (sAmt != null && secondary) {
    parts.push(formatCurrency(sAmt, secondary, true))
  }
  if (parts.length === 0) return null

  return (
    <p className="text-[11px] text-[var(--color-brand-text-muted)] font-mono-numbers">
      ({parts.join(' · ')})
    </p>
  )
}
