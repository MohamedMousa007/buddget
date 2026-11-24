'use client'

import { useMemo, useState } from 'react'
import { useAccounts } from '@/lib/accounts/useAccounts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { defaultDepositSourceId, defaultLegAccountId, depositSourceIds, eligibleLegAccountIds } from '@/lib/savings/legChoices'
import type { SavingsAccount } from '@/lib/store/types'

/**
 * State for the "From / To account" row: the primary tracked account until the user picks another.
 * `depositSource` (Add money) also offers the account holding the pocket, and starts on it.
 */
export function useLegAccount(pocket: Pick<SavingsAccount, 'heldInPaymentMethodId'> | undefined, legCurrency: string, depositSource = false) {
  const methods = useFinanceStore((s) => s.paymentMethods)
  const { accounts } = useAccounts()
  const [picked, setPicked] = useState<string | null>(null)
  const heldIn = pocket?.heldInPaymentMethodId
  return useMemo(() => {
    const target = { heldInPaymentMethodId: heldIn }
    const ids = (depositSource ? depositSourceIds : eligibleLegAccountIds)(methods, target, legCurrency)
    const accountId = picked && ids.includes(picked) ? picked : (depositSource ? defaultDepositSourceId : defaultLegAccountId)(methods, target, legCurrency) ?? null
    return { views: accounts.filter((a) => ids.includes(a.method.id)), accountId, setAccountId: setPicked }
  }, [methods, accounts, picked, heldIn, legCurrency, depositSource])
}

export type LegAccount = ReturnType<typeof useLegAccount>
