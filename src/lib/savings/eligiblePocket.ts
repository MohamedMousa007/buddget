import type { SavingsAccount } from '@/lib/store/types'
import { INVESTMENT_PRODUCT_TYPES } from '@/lib/constants/savingsTypes'

const INVESTMENT = new Set<string>(INVESTMENT_PRODUCT_TYPES)

/** Currencies the server has no quote for (gold grams, crypto). */
const UNPRICED_CURRENCIES = new Set<string>(['XAU', 'BTC', 'ETH'])

/** A pocket money can be set aside in from the forms: fiat, savings-category, never an investment/market asset. */
export function isEligibleCarryPocket(p: SavingsAccount): boolean {
  return p.category === 'savings' && !INVESTMENT.has(p.type) && !UNPRICED_CURRENCIES.has(p.currency)
}
