'use client'

import { useCallback } from 'react'
import { useActionToast } from '@/components/ui/ActionToast'
import { useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { findUnplacedForTail } from '@/lib/accounts/unplacedForTail'
import { resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'

/**
 * After the user teaches an account a number, earlier bank messages that named it and were left on no account are
 * placed on it (with Undo). Linking or creating an account therefore repairs history instead of only the future.
 */
export function useReattribute() {
  const t = useT()
  const toast = useActionToast()
  return useCallback(async (accountId: string, tail: string | null | undefined) => {
    if (!tail) return
    try {
      const method = useFinanceStore.getState().paymentMethods.find((m) => m.id === accountId)
      const rows = await findUnplacedForTail(useFinanceStore.getState().expenses, tail, method ? resolvePaymentBrandKey(method.name) : null)
      if (rows.length === 0) return
      const update = useFinanceStore.getState().updateExpense
      for (const e of rows) update(e.id, { paymentMethodId: accountId })
      toast(t.accountsPage.reattached(rows.length), {
        undo: () => { for (const e of rows) useFinanceStore.getState().updateExpense(e.id, { paymentMethodId: e.paymentMethodId }) },
        undoLabel: t.common.undo,
      })
    } catch {
      // History repair is a convenience; the unplaced-messages list on Accounts still offers it.
    }
  }, [t, toast])
}
