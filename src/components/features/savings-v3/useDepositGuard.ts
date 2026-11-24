'use client'

import { useLedgerInput } from '@/lib/accounts/useAccounts'
import { accountTitle, splitMoney } from '@/components/features/accounts/accountDisplay'
import { useT } from '@/lib/i18n'
import { availableIn, correctionRefusal, depositRefusal, pocketHome, type DepositIntent, type DepositRefusal } from '@/lib/savings/pocketHome'
import type { PaymentMethod, SavingsAccount } from '@/lib/store/types'

type Pocket = Pick<SavingsAccount, 'heldInPaymentMethodId' | 'currency' | 'currentBalance'>

export interface DepositGuard {
  /** The tracked account the pocket is set aside in; null for a pocket outside the accounts. */
  holder: PaymentMethod | null
  /** Why the store would refuse this deposit, before it is submitted. */
  refusalFor: (intent: Omit<DepositIntent, 'amount'> & { amount: number; currency: string }) => DepositRefusal | null
  /** Why the store would refuse setting the pocket to this amount. */
  correctionRefusalFor: (newBalance: number) => DepositRefusal | null
  /** The refusal in the user's words. */
  message: (refusal: DepositRefusal | null) => string | null
}

/** The store's deposit guard, readable by a sheet: it explains a refusal instead of letting a submit fail silently. */
export function useDepositGuard(pocket: Pocket | undefined): DepositGuard {
  const t = useT().wealthSheets.money
  const ledger = useLedgerInput()
  const home = pocket ? pocketHome(pocket, ledger.paymentMethods) : null
  const holder = home?.kind === 'reserved' ? ledger.paymentMethods.find((m) => m.id === home.accountId) ?? null : null
  return {
    holder,
    refusalFor: ({ amount, currency, ...intent }) => {
      if (!pocket) return null
      const landed = currency === pocket.currency ? amount : ledger.convert(amount, currency, pocket.currency) ?? amount
      return depositRefusal(ledger, pocket, { ...intent, amount: landed })
    },
    correctionRefusalFor: (newBalance) => (pocket ? correctionRefusal(ledger, pocket, newBalance) : null),
    message: (refusal) => {
      if (!refusal || !pocket) return null
      if (refusal === 'no_account_leg') return t.noAccountLeg(pocket.currency)
      if (!holder) return null
      if (refusal === 'needs_account') return t.needsAccount(accountTitle(holder))
      const cur = String(holder.currency)
      const free = splitMoney(availableIn(holder.id, ledger), cur)
      return t.overAvailable(`${free.int}${free.dec} ${cur}`, accountTitle(holder))
    },
  }
}
