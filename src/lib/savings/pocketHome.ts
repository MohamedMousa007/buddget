import type { FinanceStore, PaymentMethod, SavingsAccount } from '@/lib/store/types'
import { computeBalances, type LedgerInput } from '@/lib/accounts/balance'
import { canHoldParts } from '@/lib/accounts/kinds'
import { resolveAccountId } from '@/lib/accounts/resolve'
import { primaryTrackedAccount, resolveAccountLeg } from './accountLeg'
import { balanceEpsilon } from './balanceMath'
import { tryConvertCurrency } from '@/lib/utils/currency'

/** Where a pocket's money is: inside an account that can hold parts (part of its balance), or outside every account. */
export type PocketHome = { kind: 'reserved'; accountId: string } | { kind: 'outside' }

export function pocketHome(pocket: Pick<SavingsAccount, 'heldInPaymentMethodId'>, methods: readonly PaymentMethod[]): PocketHome {
  const holder = pocket.heldInPaymentMethodId ? methods.find((m) => m.id === pocket.heldInPaymentMethodId) : undefined
  return canHoldParts(holder) ? { kind: 'reserved', accountId: holder.id } : { kind: 'outside' }
}

type LedgerState = Pick<FinanceStore, 'paymentMethods' | 'expenses' | 'incomeEvents' | 'debtPayments' | 'debts' | 'savingsTransactions' | 'savingsAccounts' | 'accountAdjustments' | 'exchangeRates'>

/** The balance engine's view of a store state. */
export const ledgerOf = (s: LedgerState): LedgerInput => ({
  paymentMethods: s.paymentMethods, expenses: s.expenses, incomeEvents: s.incomeEvents, debtPayments: s.debtPayments, debts: s.debts,
  savingsTransactions: s.savingsTransactions, savingsAccounts: s.savingsAccounts, adjustments: s.accountAdjustments,
  convert: (a, from, to) => tryConvertCurrency(a, from, to, s.exchangeRates),
})

/** Money in the account that no pocket has set aside, in the account's currency. Zero for an untracked account. */
export function availableIn(accountId: string, ledger: LedgerInput): number {
  return computeBalances(ledger).get(accountId)?.free ?? 0
}

/**
 * Why a deposit must not be written:
 * - `over_available`: more than the account the money comes from has free: the holding account for a reserve, the
 *   funding account for money that moves (into the holder, or into a pocket outside the accounts).
 * - `no_rate`: money from an account in another currency with no exchange rate to measure it by.
 * - `needs_account`: outside money aimed at a reserved pocket with no account named; it must arrive in the account first.
 * - `no_account_leg`: a budget deposit the user's main account cannot fund, so it would raise net worth from nothing.
 */
export type DepositRefusal = 'over_available' | 'no_rate' | 'needs_account' | 'no_account_leg'

type GuardedPocket = Pick<SavingsAccount, 'heldInPaymentMethodId' | 'currency'>

export interface DepositIntent {
  /** In the pocket's currency. */
  amount: number
  mode?: 'allocate' | 'declare'
  paymentMethodId?: string
  fromAccountId?: string | null
}

/**
 * The account leg a deposit carries. An explicit `paymentMethodId` is kept as given; declared money has none; a budget
 * deposit takes the requested account, else the primary tracked one. A pocket set aside in an account, with no source
 * named, is funded from that account's own money (no leg): defaulting to the primary would book a transfer between
 * two accounts that never happened.
 */
export function depositLegId(methods: readonly PaymentMethod[], pocket: GuardedPocket, intent: Omit<DepositIntent, 'amount'>): string | undefined {
  if (intent.paymentMethodId) return intent.paymentMethodId
  if (intent.mode === 'declare') return undefined
  if (intent.fromAccountId === undefined && pocketHome(pocket, methods).kind === 'reserved') return undefined
  return resolveAccountLeg(methods, pocket, intent.fromAccountId, pocket.currency)
}

/** More than the holder has free, compared in the holder's currency. An amount with no rate is not refused. */
function exceedsAvailable(ledger: LedgerInput, pocket: GuardedPocket, accountId: string, amount: number): boolean {
  const holder = computeBalances(ledger).get(accountId)
  if (!holder) return false
  const inHolder = holder.currency === pocket.currency ? amount : ledger.convert(amount, pocket.currency, holder.currency)
  return inHolder !== null && inHolder > holder.free + balanceEpsilon(pocket.currency)
}

/**
 * A leg from an account takes the money out of it (into the holder for a held pocket, into the pocket itself for one
 * outside the accounts), so it is capped at what the source has free. A source with no known balance, or no rate to
 * measure the amount by, cannot fund one.
 */
function transferRefusal(ledger: LedgerInput, pocket: GuardedPocket, sourceId: string | null, amount: number): 'over_available' | 'no_rate' | null {
  const source = sourceId ? computeBalances(ledger).get(sourceId) : undefined
  if (!source) return 'over_available'
  const inSource = source.currency === pocket.currency ? amount : ledger.convert(amount, pocket.currency, source.currency)
  if (inSource === null) return 'no_rate'
  return inSource > source.free + balanceEpsilon(pocket.currency) ? 'over_available' : null
}

/** The one guard behind every deposit writer: the store refuses on it, sheets and Buddgy explain it before submitting. */
export function depositRefusal(ledger: LedgerInput, pocket: GuardedPocket, intent: DepositIntent): DepositRefusal | null {
  const methods = ledger.paymentMethods
  // A pocket whose account is closed or deleted counts 0 (I-5): money moved into it would leave net worth.
  const holder = pocket.heldInPaymentMethodId ? methods.find((m) => m.id === pocket.heldInPaymentMethodId) : undefined
  if (pocket.heldInPaymentMethodId && (!holder || holder.closedAt)) return 'over_available'
  const declared = intent.mode === 'declare'
  const legId = depositLegId(methods, pocket, intent)
  const home = pocketHome(pocket, methods)
  if (home.kind === 'reserved') {
    if (!legId && declared) return 'needs_account'
    // No leg, or a leg that is the holder itself: the money is already in the holder and is only being set aside.
    const sourceId = legId ? resolveAccountId(legId, methods) : home.accountId
    if (sourceId !== home.accountId) return transferRefusal(ledger, pocket, sourceId, intent.amount)
    return exceedsAvailable(ledger, pocket, home.accountId, intent.amount) ? 'over_available' : null
  }
  // A leg from a tracked account takes the money out of it: available never goes below zero. A source that is not
  // tracked moves no balance, as before.
  const sourceId = legId ? resolveAccountId(legId, methods) : null
  if (sourceId && computeBalances(ledger).has(sourceId)) return transferRefusal(ledger, pocket, sourceId, intent.amount)
  // Refused only when a primary account exists and cannot carry the leg. With none (nothing tracked, or only Cash or a
  // prepaid card) the default deposit never had a leg, and it keeps that meaning.
  return !legId && !declared && primaryTrackedAccount(methods) !== null ? 'no_account_leg' : null
}

/** Raising a reserved pocket's amount by hand is a reserve too; lowering it always passes. */
export function correctionRefusal(ledger: LedgerInput, pocket: GuardedPocket & Pick<SavingsAccount, 'currentBalance'>, newBalance: number): 'over_available' | null {
  const home = pocketHome(pocket, ledger.paymentMethods)
  const rise = newBalance - pocket.currentBalance
  return home.kind === 'reserved' && rise > 0 && exceedsAvailable(ledger, pocket, home.accountId, rise) ? 'over_available' : null
}

/** The refusal in plain English for the assistant tools, which pass it to the user in their own words. */
export function explainDepositRefusal(ledger: LedgerInput, pocket: GuardedPocket, refusal: DepositRefusal, fromAccountId?: string): { error: string; hint: string } {
  const home = pocketHome(pocket, ledger.paymentMethods)
  const holder = home.kind === 'reserved' ? ledger.paymentMethods.find((m) => m.id === home.accountId) : undefined
  const account = holder?.name ?? 'its account'
  // A pocket outside the accounts with no source named is funded by the default leg (the primary account).
  const sourceId = fromAccountId ?? (holder ? undefined : resolveAccountId(depositLegId(ledger.paymentMethods, pocket, {}), ledger.paymentMethods))
  const source = sourceId && sourceId !== holder?.id ? ledger.paymentMethods.find((m) => m.id === sourceId) : undefined
  if (refusal === 'no_rate') {
    return {
      error: `There is no exchange rate between ${source?.currency ?? 'that account\'s currency'} and ${pocket.currency}, so the money cannot be moved from ${source?.name ?? 'that account'}. Nothing was added.`,
      hint: 'Ask the user to send it from an account in the pocket\'s currency.',
    }
  }
  if (refusal === 'over_available' && source) {
    return {
      error: `${source.name} only has ${availableIn(source.id, ledger)} ${source.currency} available${holder ? ` to move into ${account}` : ''}. Nothing was added.`,
      hint: 'Ask for a smaller amount, or for another account to send it from.',
    }
  }
  if (refusal === 'over_available') {
    const free = holder ? availableIn(holder.id, ledger) : 0
    return {
      error: `This pocket is set aside inside ${account}, which only has ${free} ${holder?.currency ?? pocket.currency} available. Nothing was added.`,
      hint: 'Ask for a smaller amount, or tell the user to record the new money on that account first.',
    }
  }
  if (refusal === 'needs_account') {
    return {
      error: `This pocket is set aside inside ${account}, so outside money cannot be added to it directly. Nothing was added.`,
      hint: `Tell the user to record the money on ${account} first (income, transfer or Update balance), then set it aside; or use mode allocate to set aside money already in ${account}.`,
    }
  }
  return {
    error: `No tracked account in ${pocket.currency} can fund this deposit, so it cannot come from this month's budget. Nothing was added.`,
    hint: 'Ask whether this is new money from outside the tracked accounts; if yes, use mode declare.',
  }
}
