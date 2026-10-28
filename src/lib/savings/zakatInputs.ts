import type { Currency, Debt, DebtPayment, InvestmentHolding, SavingsAccount } from '@/lib/store/types'
import type { PriceLookup } from '@/lib/savings/holdingValuation'
import { valueInvestmentHolding } from '@/lib/savings/holdingValuation'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { calculateDebtRemaining, goldGramsToMoney } from '@/lib/utils/calculations'
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
  /** True when some balance or debt had no FX path and was left out, so the figures are a lower bound. */
  incomplete: boolean
}

/** A tracked bank/cash account's balance in its own currency (excluded accounts are filtered out by the caller). */
export interface ZakatTrackedAccount {
  balance: number
  currency: string
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
  /** Tracked accounts hold real cash that pockets alone miss; absent when the user tracks none. */
  trackedAccounts?: readonly ZakatTrackedAccount[]
  /** Pockets whose money sits inside a tracked account (already counted in its balance). */
  heldInPocketIds?: ReadonlySet<string>
  /** With payments, a debt's yearly deduction is capped at what is still owed. */
  debtPayments?: readonly DebtPayment[]
}): ZakatBase {
  const { savingsAccounts, investmentHoldings, debts, baseCurrency, exchangeRates, goldPricePerGram, goldPriceAvailable, lookup, trackedAccounts, heldInPocketIds, debtPayments } = params
  const goldOk = goldPriceAvailable !== false
  let incomplete = false

  let cashAndSavings = 0
  let goldValue = 0
  let cryptoValue = 0
  let stocksValue = 0

  // Pockets: liquid ones are cash; investment pockets go to their asset line (property is never zakatable).
  for (const a of trackedAccounts ?? []) {
    const v = tryConvertCurrency(a.balance, a.currency, baseCurrency, exchangeRates)
    if (v === null) incomplete = true
    else cashAndSavings += v
  }

  for (const a of savingsAccounts) {
    if (heldInPocketIds?.has(a.id)) continue
    const v = savingsAccountBalanceInBase(a, baseCurrency, exchangeRates, goldPricePerGram, goldOk)
    if (v === null) {
      incomplete = true
      continue
    }
    if (a.category === 'savings') cashAndSavings += v
    else if (a.type === 'gold') goldValue += v
    else if (a.type === 'crypto' || a.type === 'stablecoin') cryptoValue += v
    else if (a.type === 'stocks') stocksValue += v
    else if (a.type !== 'real_estate') cashAndSavings += v
  }

  for (const h of investmentHoldings) {
    const v = valueInvestmentHolding(h, lookup)
    if (!v.priced || v.value == null) continue // unpriceable → excluded, per §
    const inBase = tryConvertCurrency(v.value, 'EGP', baseCurrency, exchangeRates)
    if (inBase === null) {
      incomplete = true
      continue
    }
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
    const owedNow = debtPayments ? calculateDebtRemaining(d, [...debtPayments]) : Infinity
    const dueUnits = Math.min(yearly, owedNow)
    if (debtIsGold(d)) {
      if (goldOk) return s + goldGramsToMoney(dueUnits, goldPricePerGram, d.goldKarat ?? 24)
      incomplete = true
      return s
    }
    const inBase = tryConvertCurrency(dueUnits, (d.currency as Currency) ?? baseCurrency, baseCurrency, exchangeRates)
    if (inBase === null) {
      incomplete = true
      return s
    }
    return s + inBase
  }, 0)

  // Gold 24k sell price per gram in base; silver estimated from the gold:silver ratio (~85:1) when
  // no silver feed exists — the nisab is explicitly an estimate and the user can switch to gold nisab.
  const gold24kSellPerGram = lookup('XAU_24K', baseCurrency)?.price ?? (goldOk ? goldPricePerGram : 0)
  const silverPerGram = gold24kSellPerGram > 0 ? gold24kSellPerGram / 85 : 0

  return { cashAndSavings, goldValue, cryptoValue, stocksValue, debtsDueThisYear, gold24kSellPerGram, silverPerGram, incomplete }
}
