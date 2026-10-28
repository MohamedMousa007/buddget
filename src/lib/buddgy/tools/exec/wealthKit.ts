import { refOf, resolveByRefOrName } from '@/lib/buddgy/tools/refs'
import { fin } from '@/lib/buddgy/tools/stores'
import { fail } from '@/lib/buddgy/tools/writeKit'
import type { ProposeResult } from '@/lib/buddgy/tools/proposal'
import { lookupAssetPrice } from '@/lib/prices/assetPriceLookup'
import type { PriceLookup } from '@/lib/savings/holdingValuation'
import { useAssetPricesStore } from '@/lib/store/useAssetPricesStore'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, FinanceStore, Goal, SavingsAccount } from '@/lib/store/types'
import { tryConvertWithGold } from '@/lib/utils/currency'
import { clampFiatToAllowed } from '@/lib/utils/currencyPickerOptions'

const CHOICE_CAP = 15

export type Refusal = Extract<ProposeResult, { ok: false }>

/** `fail`, typed as the refusal it is so plan functions can return it beside their plan. */
export const no = (error: string, hint?: string, choices?: { id: string; label: string }[]): Refusal => fail(error, hint, choices) as Refusal

/** One entity by ref or exact name, or the failure that lets the model ask the user. */
export function pick<T extends { id: string }>(
  items: readonly T[],
  input: unknown,
  nameOf: (item: T) => string,
  noun: string,
  hint: string,
): { item: T } | { error: Refusal } {
  const hit = resolveByRefOrName(items, input, nameOf)
  if (hit.kind === 'one') return { item: hit.item }
  const pool = hit.kind === 'many' ? hit.items : items
  const choices = pool.slice(0, CHOICE_CAP).map((i) => ({ id: refOf(i.id), label: nameOf(i) }))
  const asked = typeof input === 'string' && input.trim() !== ''
  const error = hit.kind === 'many' ? `Several ${noun}s match.` : asked ? `No ${noun} matches.` : `Which ${noun}?`
  return { error: no(error, hint, choices) }
}

export const priceLookup = (): PriceLookup => {
  const prices = useAssetPricesStore.getState().prices
  return (symbol, currency) => lookupAssetPrice(prices, symbol, currency)
}

/**
 * An amount entered in `currency` as the pocket will receive it. The store itself falls back to
 * the raw number when no rate exists and clamps currencies the user has not enabled to the base
 * currency, so both are refused here rather than silently mis-posted.
 */
export function inPocketCurrency(
  s: FinanceStore,
  amount: number,
  currency: Currency,
  pocket: Pick<SavingsAccount, 'currency' | 'name'>,
): { amount: number } | { error: string } {
  if (currency !== pocket.currency && clampFiatToAllowed(s.settings, currency) !== currency) {
    return { error: `${currency} is not an enabled currency in this app.` }
  }
  const converted = tryConvertWithGold(amount, currency, pocket.currency, s.exchangeRates, s.settings.baseCurrency, {
    pricePerGram: s.goldPricePerGram,
    available: s.goldPriceAvailable !== false,
  })
  if (converted === null || converted <= 0) {
    const goldHint = pocket.currency === 'XAU' ? ' Give the amount in grams (XAU) or wait for the gold price to load.' : ''
    return { error: `No exchange rate from ${currency} to ${pocket.currency} (${pocket.name}).${goldHint}` }
  }
  return { amount: converted }
}

export const goalsOnPocket = (s: FinanceStore, pocketId: string): Goal[] =>
  s.goals.filter((g) => g.linkedSavingsAccountIds.includes(pocketId))

export interface LedgerSnapshot {
  txIds: Set<string>
  incomeIds: Set<string>
  balances: Map<string, number>
  goals: Map<string, { status: Goal['status']; achievedAt: string | null }>
  noIncomeDeclared: boolean
}

export function snapshotLedger(): LedgerSnapshot {
  const s = fin()
  return {
    txIds: new Set(s.savingsTransactions.map((t) => t.id)),
    incomeIds: new Set(s.incomeEvents.map((e) => e.id)),
    balances: new Map(s.savingsAccounts.map((a) => [a.id, a.currentBalance])),
    goals: new Map(s.goals.map((g) => [g.id, { status: g.status, achievedAt: g.achievedAt }])),
    noIncomeDeclared: s.settings.noIncomeDeclared,
  }
}

/**
 * Call right after a ledger mutation. Returns the exact inverse of what that mutation did: drops the
 * rows it added, takes back its balance deltas and reopens goals it auto-achieved. Anything that
 * changed since is left alone.
 */
export function ledgerUndo(before: LedgerSnapshot): () => void {
  const s = fin()
  const addedTx = new Set(s.savingsTransactions.filter((t) => !before.txIds.has(t.id)).map((t) => t.id))
  const addedIncome = new Set(s.incomeEvents.filter((e) => !before.incomeIds.has(e.id)).map((e) => e.id))
  const deltas = new Map<string, number>()
  for (const a of s.savingsAccounts) {
    const was = before.balances.get(a.id)
    if (was !== undefined && was !== a.currentBalance) deltas.set(a.id, a.currentBalance - was)
  }
  const reopened = new Map<string, { status: Goal['status']; achievedAt: string | null }>()
  for (const g of s.goals) {
    const was = before.goals.get(g.id)
    if (was && (was.status !== g.status || was.achievedAt !== g.achievedAt)) reopened.set(g.id, was)
  }
  const flagWritten = s.settings.noIncomeDeclared
  const flagChanged = flagWritten !== before.noIncomeDeclared
  return () =>
    useFinanceStore.setState((st) => ({
      savingsTransactions: st.savingsTransactions.filter((t) => !addedTx.has(t.id)),
      incomeEvents: st.incomeEvents.filter((e) => !addedIncome.has(e.id)),
      savingsAccounts: st.savingsAccounts.map((a) =>
        deltas.has(a.id) ? { ...a, currentBalance: Math.max(0, a.currentBalance - (deltas.get(a.id) as number)) } : a,
      ),
      goals: st.goals.map((g) => (reopened.has(g.id) ? { ...g, ...reopened.get(g.id) } : g)),
      ...(flagChanged && st.settings.noIncomeDeclared === flagWritten ? { settings: { ...st.settings, noIncomeDeclared: before.noIncomeDeclared } } : {}),
    }))
}

/** The store's ledger actions return quietly when they refuse (no balance, no row). True when a row was really posted. */
export const posted = (before: LedgerSnapshot): boolean => fin().savingsTransactions.length > before.txIds.size
