import type { BudgetFacts } from '@/lib/budget/facts'
import type { FinanceStore, FinancialProfile } from '@/lib/store/types'
import { accountsBasisFor } from '@/lib/accounts/netWorthBasis'
import { liquidSavings } from '@/lib/budget/liveLinks'
import { tryConvertCurrency } from '@/lib/utils/currency'
import type { FlowValue } from './types'

/** Per-plan decisions: remembered for Buddgy, but each new plan asks them again. */
const NOT_CARRIED = new Set(['priorities', 'securityLean', 'cutFirst', 'saveTarget', 'saveCustom', 'debtStrategy'])
const RENT_CONFLICT = 0.2

/**
 * What the app already holds, keyed by the question it answers, so those questions are never asked. Answers remembered
 * from an earlier build come first and are overridden by live data: tracked income, debts and goals beat anything typed once.
 */
export function knownFromStore(f: BudgetFacts, fp: FinancialProfile | null | undefined, moneyOnHand?: number): Record<string, FlowValue> {
  const k: Record<string, FlowValue> = {}
  for (const [id, v] of Object.entries(fp?.budgetProfile ?? {})) if (!NOT_CARRIED.has(id)) k[id] = v
  const real = <T extends { id: string }>(xs: T[]) => xs.filter((x) => !x.id.startsWith('answered-'))
  if (f.monthlyIncome > 0) k.income = Math.round(f.monthlyIncome)
  if (f.incomeStability !== 'fixed' && f.incomeFloor != null && f.incomeFloor > 0) k.lowMonth = Math.round(f.incomeFloor)
  if (f.known?.has('incomeStability')) k.incomeStability = f.incomeStability
  if (f.housing) k.housing = f.housing
  if (f.housing === 'rent' && f.rent && f.rent > 0) k.rent = Math.round(f.rent)
  if (f.housing === 'rent' && f.rent && f.rent > 0 && f.ledgerRent !== undefined && Math.abs(f.ledgerRent - f.rent) / f.rent > RENT_CONFLICT) k.rentConflict = true
  if (f.known?.has('rentIncludesUtilities')) k.rentIncludesUtilities = f.rentIncludesUtilities
  if (f.known?.has('household') || f.household !== 'solo' || f.dependents > 0) k.household = f.household
  if (f.dependents > 0) k.dependents = f.dependents
  if (f.known?.has('supportsOthers')) k.supportsOthers = f.supportsOthers
  if (f.known?.has('lifestyle')) k.lifestyle = f.lifestyle
  if (f.transportMode) k.transportMode = f.transportMode
  if (f.foodFrequency) k.foodFrequency = f.foodFrequency
  if (f.cashHeavy !== undefined) k.cashHeavy = f.cashHeavy
  // Tracked accounts answer "how much do you have saved right now?" on their own, even with nothing in them.
  if (moneyOnHand !== undefined) k.savingsOnHand = Math.max(0, Math.round(moneyOnHand))
  else if (f.liquidSavings > 0) k.savingsOnHand = Math.round(f.liquidSavings)
  k.knownBillCount = f.bills.length
  k.knownSubCount = f.subscriptionCount
  const debts = real(f.debts)
  k.knownDebtCount = debts.length
  k.knownDebtMinimum = Math.round(debts.reduce((s, d) => s + d.minimum, 0))
  if (debts.some((d) => d.kind === 'credit_card' && d.balance > 0)) k.knownHighApr = true
  k.knownGoalCount = real(f.goals).length
  if ((f.averageCycles ?? 0) > 0 && f.monthlyIncome > 0) k.hasHistory = true
  return k
}

/**
 * The money already on the balance sheet, in base currency: tracked account balances plus the pockets that are not
 * held inside one. Undefined while no account is tracked (the studio then asks, as before).
 */
export function trackedMoneyOnHand(
  s: Pick<FinanceStore, 'paymentMethods' | 'expenses' | 'incomeEvents' | 'debtPayments' | 'debts' | 'savingsTransactions' | 'savingsAccounts' | 'accountAdjustments' | 'exchangeRates' | 'settings' | 'goldPricePerGram' | 'goldPriceAvailable'>,
): number | undefined {
  const base = s.settings.baseCurrency
  const basis = accountsBasisFor({
    paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: s.incomeEvents, debtPayments: s.debtPayments, debts: s.debts,
    savingsTransactions: s.savingsTransactions, savingsAccounts: s.savingsAccounts, adjustments: s.accountAdjustments,
    convert: (a, from, to) => tryConvertCurrency(a, from, to, s.exchangeRates),
  }, base)
  if (!('accountsBasis' in basis)) return undefined
  const outside = s.savingsAccounts.filter((p) => !basis.heldInPocketIds.has(p.id))
  return basis.accountsBasis + liquidSavings(outside, base, s.exchangeRates, s.goldPricePerGram, s.goldPriceAvailable)
}
