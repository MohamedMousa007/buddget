import type { Currency, SavingsAccount } from '@/lib/store/types'
import { goldGramsToMoney } from '@/lib/utils/calculations'
import { tryConvertCurrency } from '@/lib/utils/currency'

/**
 * Balance of a savings account expressed in the user's primary (base) currency for rollups.
 * Gold (XAU) uses `goldPricePerGram` (24k); fiat/stables use FX rates (stables bridge via USD).
 *
 * FAIL-CLOSED: returns `null` when the account cannot be priced — gold spot unavailable, or no
 * FX path (e.g. BTC/ETH before live crypto pricing lands). Callers MUST exclude a null from
 * totals and flag net worth incomplete; counting an unpriceable asset at its raw unit value
 * (0.5 BTC → 0.5 AED) silently corrupts net worth.
 */
export function savingsAccountBalanceInBase(
  account: SavingsAccount,
  baseCurrency: Currency,
  rates: Record<string, number>,
  goldPricePerGram: number,
  goldPriceAvailable: boolean
): number | null {
  const c = account.currency
  if (c === 'XAU') {
    if (!goldPriceAvailable) return null
    return goldGramsToMoney(account.currentBalance, goldPricePerGram, 24)
  }
  return tryConvertCurrency(account.currentBalance, c, baseCurrency, rates)
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
