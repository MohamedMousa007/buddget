import type { Currency, FinanceStore } from '@/lib/store/types'
import { tryConvertWithGold } from '@/lib/utils/currency'

/** Where money put into a pocket comes from: an account (payment method id), another pocket, or outside buddget. */
export type DepositSource =
  | { kind: 'account'; id?: string }
  | { kind: 'pocket'; id?: string }
  | { kind: 'outside'; id?: string }

/**
 * What a deposit from `source` writes:
 * - account: a budget deposit (`allocate`) out of that account, under the store's existing guard (a pocket held in an
 *   account is funded from it first, and never above what the source has free). No account picked = no leg.
 * - pocket: a move between two pockets (`transferBetweenPockets`); net worth and left-to-spend stay the same.
 * - outside: money from outside the budget (`declare`); net worth rises, left-to-spend is untouched.
 */
export type PocketDepositPlan =
  | { action: 'deposit'; opts: { mode: 'allocate'; fromAccountId: string | null } }
  | { action: 'deposit'; opts: { mode: 'declare'; source: 'outside' } }
  | { action: 'transfer'; fromPocketId: string }
  | { action: 'none'; reason: 'no_pocket_source' | 'same_pocket' }

export function planPocketDeposit(source: DepositSource, intoPocketId: string): PocketDepositPlan {
  // Marked, so the money from outside shows in Recent moves (an opening balance or a correction is not a move).
  if (source.kind === 'outside') return { action: 'deposit', opts: { mode: 'declare', source: 'outside' } }
  if (source.kind === 'pocket') {
    if (!source.id) return { action: 'none', reason: 'no_pocket_source' }
    if (source.id === intoPocketId) return { action: 'none', reason: 'same_pocket' }
    return { action: 'transfer', fromPocketId: source.id }
  }
  return { action: 'deposit', opts: { mode: 'allocate', fromAccountId: source.id ?? null } }
}

type DepositStore = Pick<
  FinanceStore,
  'depositToSavings' | 'transferBetweenPockets' | 'savingsAccounts' | 'exchangeRates' | 'settings' | 'goldPricePerGram' | 'goldPriceAvailable'
>

/**
 * Writes one Add money: `amount` is in `currency` (the sheet's unit). A pocket-to-pocket move is measured in the source
 * pocket's own unit, so the amount is converted first; no rate means nothing is written. False when the store refused.
 */
export function applyPocketDeposit(
  store: DepositStore,
  input: { pocketId: string; amount: number; currency: Currency; source: DepositSource; note?: string; date?: string; occurredAt?: string },
): boolean {
  const plan = planPocketDeposit(input.source, input.pocketId)
  if (plan.action === 'none' || !(input.amount > 0)) return false
  if (plan.action === 'transfer') {
    const from = store.savingsAccounts.find((a) => a.id === plan.fromPocketId)
    if (!from) return false
    const inFrom = input.currency === from.currency
      ? input.amount
      : tryConvertWithGold(input.amount, input.currency, from.currency, store.exchangeRates, store.settings.baseCurrency, {
          pricePerGram: store.goldPricePerGram,
          available: store.goldPriceAvailable !== false,
        })
    if (inFrom === null || !(inFrom > 0)) return false
    return store.transferBetweenPockets(plan.fromPocketId, input.pocketId, inFrom, input.note, input.date, input.occurredAt)
  }
  return store.depositToSavings(input.pocketId, input.amount, input.currency, input.note, {
    ...plan.opts,
    ...(input.date ? { date: input.date } : {}),
    ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
  })
}
