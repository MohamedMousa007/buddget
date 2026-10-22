import type { Currency, Debt, FinanceStore, InvestmentHolding, SavingsAccount } from '@/lib/store/types'
import { savingsAccountBalanceInBase } from '@/lib/savings/savingsConversions'
import { totalInvestmentValue, type PriceLookup } from '@/lib/savings/holdingValuation'
import { convertCurrency } from '@/lib/utils/currency'

export interface NetWorthInput {
  savingsAccounts: SavingsAccount[]
  investmentHoldings: InvestmentHolding[]
  debts: Debt[]
  settings: FinanceStore['settings']
  exchangeRates: Record<string, number>
  goldPricePerGram: number
  goldPriceAvailable: boolean
  lookup: PriceLookup
  /** This cycle's figures from the monthly stats. */
  monthlyIncome: number
  cashOutflow: number
  debtRemaining: number
  /**
   * Sum of tracked account balances in base currency. When present it replaces the monthly-flow term
   * (accounts carry cash across months, so a flow term would double count) and the pockets listed in
   * `heldInPocketIds` are skipped (their money already sits inside an account balance).
   */
  accountsBasis?: number
  heldInPocketIds?: ReadonlySet<string>
}

export interface NetWorthResult {
  netWorth: number
  netWorthSecondary: number | null
  totalSavings: number
  totalInvestments: number
  totalDebt: number
  monthlyIncome: number
  monthlyFlow: number
  /** Tracked accounts total (base currency), when the accounts basis is in use. */
  accountsTotal: number | null
  baseCurrency: Currency
  netWorthGoldIncomplete: boolean
  netWorthIncomplete: boolean
}

/**
 * Net worth snapshot: savings + investments (account balances) + this month's cash flow − debt.
 *
 * The flow term is CASH movement (`cashOutflow`), not accrual spend: accrual double-counted anything
 * already carried by the balance sheet (a card charge hit flow AND outstanding), so each event now
 * moves net worth exactly once — see {@link calculateCashOutflow}.
 */
export function computeNetWorth(i: NetWorthInput): NetWorthResult {
  const { settings, exchangeRates } = i
  const base = settings.baseCurrency
  const goldOk = i.goldPriceAvailable !== false
  let totalSavings = 0
  let totalInvestments = 0
  // A null valuation means the asset can't be priced (no FX path). Exclude it and flag incomplete,
  // never count it at its raw unit value.
  let valuationIncomplete = false
  for (const a of i.savingsAccounts) {
    if (i.accountsBasis !== undefined && i.heldInPocketIds?.has(a.id)) continue
    const v = savingsAccountBalanceInBase(a, base, exchangeRates, i.goldPricePerGram, goldOk)
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
  totalInvestments += convertCurrency(holdings.total, 'EGP', base, exchangeRates)

  const monthlyFlow = i.monthlyIncome - i.cashOutflow
  const netWorth = totalSavings + totalInvestments + (i.accountsBasis ?? monthlyFlow) - i.debtRemaining

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
    monthlyIncome: i.monthlyIncome,
    monthlyFlow,
    accountsTotal: i.accountsBasis ?? null,
    baseCurrency: base,
    netWorthGoldIncomplete,
    netWorthIncomplete: netWorthGoldIncomplete || valuationIncomplete,
  }
}
