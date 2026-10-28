'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useRates } from '@/hooks/useRates'
import { tryConvertCurrency } from '@/lib/utils/currency'
import type { PaymentMethod } from '@/lib/store/types'
import { computeBalances, type AccountBalance, type LedgerInput } from './balance'
import { DEFAULT_CASH_ID, isOpenAccount, isTracked } from './kinds'

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
  approx: boolean
  /** No real Cash account yet: the page offers to start tracking cash. */
  needsCash: boolean
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
    const open = s.paymentMethods.filter((m) => isOpenAccount(m) && !m.parentId)
    const accounts = open.map((m) => ({
      method: m,
      cards: s.paymentMethods.filter((c) => c.parentId === m.id && !c.closedAt),
      balance: balances.get(m.id) ?? null,
    }))
    let totalInBase = 0
    let heldInBase = 0
    let approx = false
    for (const a of accounts) {
      if (!a.balance || a.method.excluded) continue
      approx ||= a.balance.approx || String(a.method.currency) !== String(s.base)
      totalInBase += tryConvertCurrency(a.balance.balance, a.balance.currency, s.base, rates) ?? a.balance.balance
      heldInBase += tryConvertCurrency(a.balance.held, a.balance.currency, s.base, rates) ?? a.balance.held
    }
    const accountIds = new Set(accounts.map((a) => a.method.id))
    const standaloneCards = s.paymentMethods.filter(
      (m) => !m.closedAt && m.type !== 'cash' && !accountIds.has(m.id) && !(m.parentId && accountIds.has(m.parentId)),
    )
    const needsCash = !s.paymentMethods.some((m) => m.type === 'cash' && m.id !== DEFAULT_CASH_ID && !m.closedAt)
    return { accounts, standaloneCards, totalInBase, heldInBase, approx, needsCash }
  }, [s, rates])
}

export { isTracked }
