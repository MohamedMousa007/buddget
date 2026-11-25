'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useRates } from '@/hooks/useRates'
import { tryConvertCurrency } from '@/lib/utils/currency'
import type { PaymentMethod } from '@/lib/store/types'
import { computeBalances, type AccountBalance, type LedgerInput } from './balance'
import { isSetUpAccount, isTracked } from './kinds'

export interface AccountView {
  method: PaymentMethod
  /** Cards that hang under this account (debit/credit/prepaid with parentId). */
  cards: PaymentMethod[]
  /** null = balance not set yet. */
  balance: AccountBalance | null
}

export interface AccountsModel {
  accounts: AccountView[]
  /** Cards with no parent account. */
  standaloneCards: PaymentMethod[]
  /** Sum of tracked balances in base currency. */
  totalInBase: number
  /** Sum of held-in pockets in base currency. */
  heldInBase: number
  /** "Available now": the sum of each account's own free money, so it equals the rows under it. */
  freeInBase: number
  approx: boolean
  /** No tracked Cash yet (every user has an untracked one): the page offers to start tracking cash. */
  needsCash: boolean
}

/**
 * The hero's totals over the counted rows (tracked, not excluded). Available is summed per account: an account with
 * more set aside than it holds contributes zero, it never eats into another account's money.
 */
export function accountTotals(
  accounts: readonly Pick<AccountView, 'method' | 'balance'>[],
  base: string,
  convert: (amount: number, from: string, to: string) => number | null,
): Pick<AccountsModel, 'totalInBase' | 'heldInBase' | 'freeInBase' | 'approx'> {
  let totalInBase = 0
  let heldInBase = 0
  let freeInBase = 0
  let approx = false
  for (const a of accounts) {
    if (!a.balance || a.method.excluded) continue
    approx ||= a.balance.approx || String(a.method.currency) !== base
    const total = convert(a.balance.balance, a.balance.currency, base)
    const held = convert(a.balance.held, a.balance.currency, base)
    const free = convert(a.balance.free, a.balance.currency, base)
    // No rate to base: leave the account out (as net worth does) and keep the figure marked approximate.
    if (total === null || held === null || free === null) { approx = true; continue }
    totalInBase += total
    heldInBase += held
    freeInBase += free
  }
  return { totalInBase, heldInBase, freeInBase, approx }
}

/** Cards with no open parent account. A provisional method waits in the detected-accounts sheet, never here. */
export function standaloneCardsOf(methods: readonly PaymentMethod[], accountIds: ReadonlySet<string>): PaymentMethod[] {
  return methods.filter(
    (m) => !m.closedAt && !m.provisional && m.type !== 'cash' && !accountIds.has(m.id) && !(m.parentId && accountIds.has(m.parentId)),
  )
}

function useLedgerStore() {
  return useFinanceStore(useShallow((st) => ({
    paymentMethods: st.paymentMethods, expenses: st.expenses, incomeEvents: st.incomeEvents,
    debtPayments: st.debtPayments, debts: st.debts, savingsTransactions: st.savingsTransactions,
    savingsAccounts: st.savingsAccounts, adjustments: st.accountAdjustments,
    rates: st.exchangeRates, base: st.settings.baseCurrency,
  })))
}

/** The ledger the balance engine reads, with the app's FX converter plugged in. */
export function useLedgerInput(): LedgerInput & { base: string } {
  useRates()
  const s = useLedgerStore()
  return useMemo(() => ({
    ...s,
    convert: (a: number, from: string, to: string) => tryConvertCurrency(a, from, to, s.rates),
  }), [s])
}

/** Single place the UI reads account balances from; derived from the ledger, never stored. */
export function useAccounts(): AccountsModel {
  const s = useLedgerInput()
  const rates = useFinanceStore((st) => st.exchangeRates)

  return useMemo(() => {
    const balances = computeBalances(s)
    const open = s.paymentMethods.filter((m) => isSetUpAccount(m) && !m.parentId)
    const accounts = open.map((m) => ({
      method: m,
      cards: s.paymentMethods.filter((c) => c.parentId === m.id && !c.closedAt),
      balance: balances.get(m.id) ?? null,
    }))
    const totals = accountTotals(accounts, String(s.base), (a, from, to) => tryConvertCurrency(a, from, to, rates))
    const accountIds = new Set(accounts.map((a) => a.method.id))
    const standaloneCards = standaloneCardsOf(s.paymentMethods, accountIds)
    const needsCash = !s.paymentMethods.some((m) => m.type === 'cash' && isSetUpAccount(m))
    return { accounts, standaloneCards, ...totals, needsCash }
  }, [s, rates])
}

export { isTracked }
