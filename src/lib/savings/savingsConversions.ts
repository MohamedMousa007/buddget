import type { Currency, SavingsAccount } from '@/lib/store/types'
import { goldGramsToMoney } from '@/lib/utils/calculations'
import { convertCurrency, tryConvertCurrency } from '@/lib/utils/currency'

/**
 * Balance of a savings account expressed in the user's primary (base) currency for rollups.
 * Gold (XAU) uses `goldPricePerGram` (24k); fiat/crypto use FX rates (stables bridge via USD).
 */
export function savingsAccountBalanceInBase(
  account: SavingsAccount,
  baseCurrency: Currency,
  rates: Record<string, number>,
  goldPricePerGram: number,
  goldPriceAvailable: boolean
): number {
  const c = account.currency
  if (c === 'XAU') {
    if (!goldPriceAvailable) return 0
    return goldGramsToMoney(account.currentBalance, goldPricePerGram, 24)
  }
  return convertCurrency(account.currentBalance, c, baseCurrency, rates)
}

export function needsLiveValuationPlaceholder(account: SavingsAccount): boolean {
  if (account.type === 'stocks') return true
  const c = account.currency
  if (c === 'BTC' || c === 'ETH') return true
  return false
}

/**
 * Optional converted amounts for card sublines (native balance stays on the main line).
 */
export function savingsAccountConversionAmounts(
  account: SavingsAccount,
  primary: Currency,
  secondary: Currency | null,
  showSecondary: boolean,
  rates: Record<string, number>,
  goldPricePerGram: number
): { primary: number | null; secondary: number | null; needsPlaceholder: boolean } {
  if (needsLiveValuationPlaceholder(account)) {
    return { primary: null, secondary: null, needsPlaceholder: true }
  }

  // XAU balances are in grams; the rates map's XAU cross-rate is per troy ounce,
  // so route gold through the base-currency spot (goldPricePerGram) instead.
  const toCurrency = (target: Currency): number | null => {
    if (account.currency === target) return null
    if (account.currency === 'XAU') {
      const base = goldGramsToMoney(account.currentBalance, goldPricePerGram, 24)
      return target === primary ? base : tryConvertCurrency(base, primary, target, rates)
    }
    return tryConvertCurrency(account.currentBalance, account.currency, target, rates)
  }

  const primaryConv = toCurrency(primary)
  const secondaryConv =
    showSecondary && secondary ? toCurrency(secondary) : null

  return { primary: primaryConv, secondary: secondaryConv, needsPlaceholder: false }
}
