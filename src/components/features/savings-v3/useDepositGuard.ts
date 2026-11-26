'use client'

import { useLedgerInput } from '@/lib/accounts/useAccounts'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import { useT } from '@/lib/i18n'
import { formatFlex } from '@/lib/utils/formatters'
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
  /** The refusal in the user's words. `fromAccountId` is the chosen source, named when it is the account that is short. */
  message: (refusal: DepositRefusal | null, fromAccountId?: string | null) => string | null
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
    message: (refusal, fromAccountId) => {
      if (!refusal || !pocket) return null
      if (refusal === 'no_account_leg') return t.noAccountLeg(pocket.currency)
      if (refusal === 'needs_account') return holder ? t.needsAccount(accountTitle(holder)) : null
      const short = (fromAccountId ? ledger.paymentMethods.find((m) => m.id === fromAccountId) : null) ?? holder
      if (!short) return null
      if (refusal === 'no_rate') return t.noRateFrom(accountTitle(short))
      const cur = String(short.currency)
      return t.overAvailable(`${formatFlex(availableIn(short.id, ledger))} ${cur}`, accountTitle(short))
    },
  }
}
