import type { Currency, Debt, InvestmentHolding, SavingsAccount } from '@/lib/store/types'
import type { PriceLookup } from '@/lib/savings/holdingValuation'
import { valueInvestmentHolding } from '@/lib/savings/holdingValuation'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { convertCurrency } from '@/lib/utils/currency'

/** The live "what counts" figures for zakat, in base currency, before any user override. */
export interface ZakatBase {
  cashAndSavings: number
  goldValue: number
  cryptoValue: number
  stocksValue: number
  debtsDueThisYear: number
  gold24kSellPerGram: number
  silverPerGram: number
}

export function deriveZakatBase(params: {
  savingsAccounts: SavingsAccount[]
  investmentHoldings: InvestmentHolding[]
  debts: Debt[]
  baseCurrency: Currency
  exchangeRates: Record<string, number>
  goldPricePerGram: number
  goldPriceAvailable: boolean
  lookup: PriceLookup
}): ZakatBase {
  const { savingsAccounts, investmentHoldings, debts, baseCurrency, exchangeRates, goldPricePerGram, goldPriceAvailable, lookup } = params
  const goldOk = goldPriceAvailable !== false

  // Cash & savings — every liquid savings pocket (investments valued separately below).
  const cashAndSavings = savingsAccounts
    .filter((a) => a.category === 'savings')
    .reduce((s, a) => s + (savingsAccountBalanceInBase(a, baseCurrency, exchangeRates, goldPricePerGram, goldOk) ?? 0), 0)

  let goldValue = 0
  let cryptoValue = 0
  let stocksValue = 0
  for (const h of investmentHoldings) {
    const v = valueInvestmentHolding(h, lookup)
    if (!v.priced || v.value == null) continue // unpriceable → excluded, per §
    const inBase = convertCurrency(v.value, 'EGP', baseCurrency, exchangeRates)
    if (h.assetType === 'gold') goldValue += inBase
    else if (h.assetType === 'crypto') cryptoValue += inBase
    else if (h.assetType === 'stock') stocksValue += inBase
    // property is never zakatable
  }

  // Short-term liabilities — this year's scheduled installments (a concrete, editable estimate).
  const debtsDueThisYear = debts.reduce((s, d) => {
    const monthly = Number(d.installmentAmount ?? 0) || 0
    if (monthly <= 0) return s
    return s + convertCurrency(monthly * 12, (d.currency as Currency) ?? baseCurrency, baseCurrency, exchangeRates)
  }, 0)

  // Gold 24k sell price per gram in base; silver estimated from the gold:silver ratio (~85:1) when
  // no silver feed exists — the nisab is explicitly an estimate and the user can switch to gold nisab.
  const gold24kSellPerGram = lookup('XAU_24K', baseCurrency)?.price ?? (goldOk ? goldPricePerGram : 0)
  const silverPerGram = gold24kSellPerGram > 0 ? gold24kSellPerGram / 85 : 0

  return { cashAndSavings, goldValue, cryptoValue, stocksValue, debtsDueThisYear, gold24kSellPerGram, silverPerGram }
}
