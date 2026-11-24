import type { Currency, Debt, FinanceStore, InvestmentHolding, SavingsAccount } from '@/lib/store/types'
import { pocketBalanceInBase } from '@/lib/savings/savingsConversions'
import { totalInvestmentValue, type PriceLookup } from '@/lib/savings/holdingValuation'
import { convertCurrency, tryConvertCurrency } from '@/lib/utils/currency'

export interface NetWorthInput {
  savingsAccounts: SavingsAccount[]
  investmentHoldings: InvestmentHolding[]
  debts: Debt[]
  settings: FinanceStore['settings']
  exchangeRates: Record<string, number>
  goldPricePerGram: number
  goldPriceAvailable: boolean
  lookup: PriceLookup
  debtRemaining: number
  /**
   * Sum of tracked account balances in base currency; absent (0) when no account is tracked. The pockets listed in
   * `heldInPocketIds` are skipped (their money already sits inside an account balance).
   */
  accountsBasis?: number
  heldInPocketIds?: ReadonlySet<string>
  /** A tracked account had no rate to the base currency and was left out of `accountsBasis`. */
  accountsIncomplete?: boolean
}

export interface NetWorthResult {
  netWorth: number
  netWorthSecondary: number | null
  totalSavings: number
  totalInvestments: number
  totalDebt: number
  /** Tracked accounts total (base currency), when the accounts basis is in use. */
  accountsTotal: number | null
  baseCurrency: Currency
  netWorthGoldIncomplete: boolean
  netWorthIncomplete: boolean
}

/**
 * Net worth: pockets + investments + tracked account balances − debt. Only balances count: with no tracked
 * account, cash the app cannot see is not guessed from this month's income and spending.
 */
export function computeNetWorth(i: NetWorthInput): NetWorthResult {
  const { settings, exchangeRates } = i
  const base = settings.baseCurrency
  const goldOk = i.goldPriceAvailable !== false
  let totalSavings = 0
  let totalInvestments = 0
  // A null valuation means the asset can't be priced (no FX path). Exclude it and flag incomplete,
  // never count it at its raw unit value.
  let valuationIncomplete = i.accountsIncomplete === true
  for (const a of i.savingsAccounts) {
    if (i.accountsBasis !== undefined && i.heldInPocketIds?.has(a.id)) continue
    const v = pocketBalanceInBase(a, base, exchangeRates, i.goldPricePerGram, goldOk, i.lookup)
    if (v === null) {
      valuationIncomplete = true
      continue
    }
    if (a.category === 'investment') totalInvestments += v
    else totalSavings += v
  }

  // Holdings are valued in EGP regardless of base currency.
  const holdings = totalInvestmentValue(i.investmentHoldings, i.lookup)
  if (holdings.anyUnpriced) valuationIncomplete = true
  const holdingsInBase = tryConvertCurrency(holdings.total, 'EGP', base, exchangeRates)
  if (holdingsInBase === null) valuationIncomplete = true
  else totalInvestments += holdingsInBase

  const netWorth = totalSavings + totalInvestments + (i.accountsBasis ?? 0) - i.debtRemaining

  const netWorthSecondary =
    settings.showSecondaryCurrency && settings.secondaryCurrency
      ? convertCurrency(netWorth, base, settings.secondaryCurrency, exchangeRates)
      : null

  const hasGoldSavings = i.savingsAccounts.some((a) => a.currency === 'XAU')
  const hasGoldDebt = i.debts.some((d) => d.isGold)
  const netWorthGoldIncomplete = !goldOk && (hasGoldSavings || hasGoldDebt)

  return {
    netWorth,
    netWorthSecondary,
    totalSavings,
    totalInvestments,
    totalDebt: i.debtRemaining,
    accountsTotal: i.accountsBasis ?? null,
    baseCurrency: base,
    netWorthGoldIncomplete,
    netWorthIncomplete: netWorthGoldIncomplete || valuationIncomplete,
  }
}

/**
 * What a saved snapshot measured, so the trend only compares like with like: `accounts` (tracked balances counted),
 * `assets` (no tracked account: pockets, investments and debt only), `legacy` (old rows that added this month's flow).
 */
export type NetWorthBasis = 'legacy' | 'accounts' | 'assets'

export const netWorthBasisOf = (nw: Pick<NetWorthResult, 'accountsTotal'>): Exclude<NetWorthBasis, 'legacy'> =>
  nw.accountsTotal != null ? 'accounts' : 'assets'
