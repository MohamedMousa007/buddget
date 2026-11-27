import { computeBalances } from '@/lib/accounts/balance'
import { deterministicId } from '@/lib/savings/accountLeg'
import { balanceEpsilon } from '@/lib/savings/balanceMath'
import { ledgerOf } from '@/lib/savings/pocketHome'
import type { DepositSource } from '@/lib/savings/moneySourceDeposit'
import type { Currency, FinanceStore, InvestmentHolding } from '@/lib/store/types'
import { tryConvertWithGold } from '@/lib/utils/currency'
import { localTodayISO } from '@/lib/utils/localDate'

/**
 * Why an asset buy (gold, crypto, stocks, property) must not be written:
 * - `no_paid`: money left an account or pocket but no amount was given (or the asset has no quantity).
 * - `no_account` / `no_pocket`: the source was not picked, or no longer exists.
 * - `no_price`: no live price, so the asset cannot be valued against what left.
 * - `no_rate`: the paid amount has no exchange path into the account's or pocket's unit.
 * - `over_available`: more than the account has free (money set aside for pockets stays put).
 * - `over_pocket`: more than the pocket holds.
 */
export type AssetPurchaseRefusal = 'no_paid' | 'no_account' | 'no_pocket' | 'no_price' | 'no_rate' | 'over_available' | 'over_pocket'

/**
 * What a buy writes besides the holding:
 * - account: a `Savings` row out of that account (money moved into the asset, not spending), so net worth only moves
 *   by the gap between what was paid and today's value.
 * - pocket: a non-income withdrawal of the paid amount from the pocket, in the pocket's unit.
 * - outside: nothing; the asset is new money in net worth.
 */
export type AssetPurchasePlan =
  | { action: 'holding' }
  | { action: 'account'; accountId: string }
  | { action: 'pocket'; pocketId: string; amount: number }
  | { action: 'refuse'; reason: AssetPurchaseRefusal }

type PlanStore = Pick<
  FinanceStore,
  | 'paymentMethods' | 'expenses' | 'incomeEvents' | 'debtPayments' | 'debts' | 'savingsTransactions' | 'savingsAccounts'
  | 'accountAdjustments' | 'exchangeRates' | 'settings' | 'goldPricePerGram' | 'goldPriceAvailable'
>

export interface AssetPurchaseInput {
  source: DepositSource
  /** What was paid, in `currency`. */
  paid: number
  currency: Currency
  /** The asset can be valued (a live price, or a typed worth); without it only an outside buy is written. */
  priced: boolean
}

const NON_MONEY = new Set<string>(['XAU', 'BTC', 'ETH'])

/** The currency the paid amount is typed in: the account's, a money pocket's, else `fallback` (the base currency). */
export function assetPayCurrency(
  store: Pick<PlanStore, 'paymentMethods' | 'savingsAccounts' | 'settings'>,
  source: DepositSource,
  fallback: Currency = store.settings.baseCurrency,
): Currency {
  if (source.kind === 'account') return (store.paymentMethods.find((m) => m.id === source.id)?.currency as Currency | undefined) ?? fallback
  if (source.kind === 'pocket') {
    const cur = store.savingsAccounts.find((a) => a.id === source.id)?.currency
    return cur && !NON_MONEY.has(cur) ? cur : store.settings.baseCurrency
  }
  return fallback
}

export function planAssetPurchase(store: PlanStore, input: AssetPurchaseInput): AssetPurchasePlan {
  const { source, paid, currency } = input
  if (source.kind === 'outside') return { action: 'holding' }
  if (!(paid > 0)) return { action: 'refuse', reason: 'no_paid' }
  if (!input.priced) return { action: 'refuse', reason: 'no_price' }
  if (source.kind === 'account') {
    const method = source.id ? store.paymentMethods.find((m) => m.id === source.id) : undefined
    if (!method) return { action: 'refuse', reason: 'no_account' }
    const ledger = ledgerOf(store)
    const bal = computeBalances(ledger).get(method.id)
    // An account with no balance yet moves nothing on the ledger, like any expense from it.
    if (bal) {
      const inAccount = bal.currency === currency ? paid : ledger.convert(paid, currency, bal.currency)
      if (inAccount === null) return { action: 'refuse', reason: 'no_rate' }
      if (inAccount > Math.max(0, bal.free) + balanceEpsilon(bal.currency as Currency)) return { action: 'refuse', reason: 'over_available' }
    }
    return { action: 'account', accountId: method.id }
  }
  const pocket = source.id ? store.savingsAccounts.find((a) => a.id === source.id) : undefined
  if (!pocket) return { action: 'refuse', reason: 'no_pocket' }
  const amount = pocket.currency === currency
    ? paid
    : tryConvertWithGold(paid, currency, pocket.currency, store.exchangeRates, store.settings.baseCurrency, {
        pricePerGram: store.goldPricePerGram,
        available: store.goldPriceAvailable !== false,
      })
  if (amount === null || !(amount > 0)) return { action: 'refuse', reason: 'no_rate' }
  if (amount > pocket.currentBalance + balanceEpsilon(pocket.currency)) return { action: 'refuse', reason: 'over_pocket' }
  return { action: 'pocket', pocketId: pocket.id, amount }
}

/** Id of the money row (expense or pocket withdrawal) that paid for a holding: derived, so either side finds the other. */
export const assetFundingId = (holdingId: string): string => deterministicId(`asset-buy|${holdingId}`)

/** The holding a money row paid for, if any. */
export function holdingFundedBy(holdings: readonly InvestmentHolding[], rowId: string): InvestmentHolding | undefined {
  return holdings.find((h) => assetFundingId(h.id) === rowId)
}

type WriteStore = PlanStore & Pick<FinanceStore, 'addExpense' | 'withdrawFromSavings' | 'addInvestmentHolding' | 'deleteInvestmentHolding'>

export type NewHolding = Omit<InvestmentHolding, 'id' | 'createdAt' | 'updatedAt' | 'purchaseDate' | 'unitCost' | 'costBasisCurrency'>

export interface AssetBuy extends AssetPurchaseInput {
  holding: NewHolding
  /** Units the cost is spread over (grams, coins, shares; 1 for property). */
  units: number
  /** Local day (`yyyy-MM-dd`) and exact instant of the buy. No day = not known (an outside asset); a money row uses today. */
  date?: string
  occurredAt: string
}

/**
 * Writes one asset buy per {@link planAssetPurchase}: the holding, then its money row under {@link assetFundingId}, so
 * deleting either side can remove both. A refused money row takes the holding back out. Returns the refusal, or null.
 */
export function applyAssetPurchase(store: WriteStore, buy: AssetBuy): AssetPurchaseRefusal | null {
  if (!(buy.units > 0)) return 'no_paid'
  const plan = planAssetPurchase(store, buy)
  if (plan.action === 'refuse') return plan.reason
  const id = store.addInvestmentHolding({
    ...buy.holding,
    purchaseDate: buy.date,
    ...(buy.paid > 0 ? { unitCost: buy.paid / buy.units, costBasisCurrency: buy.currency } : {}),
  })
  if (plan.action === 'account') {
    store.addExpense({
      id: assetFundingId(id), description: buy.holding.name, category: 'Savings', amount: buy.paid, currency: buy.currency,
      date: buy.date ?? localTodayISO(), occurredAt: buy.occurredAt, paymentMethodId: plan.accountId, isRecurring: false,
    })
  } else if (plan.action === 'pocket') {
    const pocket = store.savingsAccounts.find((a) => a.id === plan.pocketId)!
    const ok = store.withdrawFromSavings(plan.pocketId, plan.amount, pocket.currency, buy.holding.name, 'transfer', {
      txId: assetFundingId(id), date: buy.date ?? localTodayISO(), occurredAt: buy.occurredAt,
    })
    if (!ok) {
      store.deleteInvestmentHolding(id)
      return 'over_pocket'
    }
  }
  return null
}
