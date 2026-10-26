import type { Currency, Debt, InvestmentHolding, SavingsAccount } from '@/lib/store/types'
import type { PriceLookup } from '@/lib/savings/holdingValuation'
import { valueInvestmentHolding } from '@/lib/savings/holdingValuation'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { convertCurrency } from '@/lib/utils/currency'
import { goldGramsToMoney } from '@/lib/utils/calculations'
import { isOwedToUser } from '@/lib/debts/debtDirection'
import { debtIsGold } from '@/lib/debt/debtGold'

const PAYMENTS_PER_YEAR = { weekly: 52, monthly: 12, quarterly: 4, annually: 1 } as const

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

  let cashAndSavings = 0
  let goldValue = 0
  let cryptoValue = 0
  let stocksValue = 0

  // Pockets: liquid ones are cash; investment pockets go to their asset line (property is never zakatable).
  for (const a of savingsAccounts) {
    const v = savingsAccountBalanceInBase(a, baseCurrency, exchangeRates, goldPricePerGram, goldOk)
    if (v === null) continue
    if (a.category === 'savings') cashAndSavings += v
    else if (a.type === 'gold') goldValue += v
    else if (a.type === 'crypto' || a.type === 'stablecoin') cryptoValue += v
    else if (a.type === 'stocks') stocksValue += v
    else if (a.type !== 'real_estate') cashAndSavings += v
  }

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
    if (d.status === 'cleared' || isOwedToUser(d)) return s
    const installment = Number(d.installmentAmount ?? 0) || 0
    if (installment <= 0) return s
    const yearly = installment * PAYMENTS_PER_YEAR[d.installmentFrequency ?? 'monthly']
    if (debtIsGold(d)) return goldOk ? s + goldGramsToMoney(yearly, goldPricePerGram, d.goldKarat ?? 24) : s
    return s + convertCurrency(yearly, (d.currency as Currency) ?? baseCurrency, baseCurrency, exchangeRates)
  }, 0)

  // Gold 24k sell price per gram in base; silver estimated from the gold:silver ratio (~85:1) when
  // no silver feed exists — the nisab is explicitly an estimate and the user can switch to gold nisab.
  const gold24kSellPerGram = lookup('XAU_24K', baseCurrency)?.price ?? (goldOk ? goldPricePerGram : 0)
  const silverPerGram = gold24kSellPerGram > 0 ? gold24kSellPerGram / 85 : 0

  return { cashAndSavings, goldValue, cryptoValue, stocksValue, debtsDueThisYear, gold24kSellPerGram, silverPerGram }
}
