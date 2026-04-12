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
  goldPricePerGram: number
): number {
  const c = account.currency
  if (c === 'XAU') {
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
  rates: Record<string, number>
): { primary: number | null; secondary: number | null; needsPlaceholder: boolean } {
  if (needsLiveValuationPlaceholder(account)) {
    return { primary: null, secondary: null, needsPlaceholder: true }
  }

  let primaryConv: number | null = null
  if (account.currency !== primary) {
    primaryConv = tryConvertCurrency(account.currentBalance, account.currency, primary, rates)
  }

  let secondaryConv: number | null = null
  if (showSecondary && secondary && secondary !== account.currency) {
    secondaryConv = tryConvertCurrency(account.currentBalance, account.currency, secondary, rates)
  }

  return { primary: primaryConv, secondary: secondaryConv, needsPlaceholder: false }
}
