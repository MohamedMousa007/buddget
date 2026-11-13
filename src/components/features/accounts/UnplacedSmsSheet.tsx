'use client'

import { useState } from 'react'
import { ResolveRow, ResolveSheet, ResolveTile } from '@/components/modals/ResolveSheet'
import type { AccountView } from '@/lib/accounts/useAccounts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Expense } from '@/lib/store/types'
import { useT } from '@/lib/i18n'
import { AccountPicker } from './AccountPicker'
import { splitMoney } from './accountDisplay'

/** Lists the bank-message expenses that sit on no account and lets the user place them all on one account. */
export function UnplacedSmsSheet({ open, onClose, items, accounts }: { open: boolean; onClose: () => void; items: Expense[]; accounts: AccountView[] }) {
  const t = useT().accountsPage
  const updateExpense = useFinanceStore((s) => s.updateExpense)
  const [picked, setPicked] = useState('')
  const accountId = picked || accounts[0]?.method.id || ''
  const attach = () => {
    for (const e of items) updateExpense(e.id, { paymentMethodId: accountId })
    onClose()
  }
  return (
    <ResolveSheet
      open={open}
      onClose={onClose}
      title={t.unplacedTitle(items.length)}
      subtitle={t.unplacedSub}
      field={<AccountPicker accounts={accounts} value={accountId} onChange={setPicked} label={t.unplacedAccount} />}
      primary={{ label: t.unplacedAttach(items.length), onPress: attach, disabled: !accountId || items.length === 0 }}
    >
      {items.map((e) => {
        const m = splitMoney(e.amount, String(e.currency))
        return <ResolveRow key={e.id} state="plain" leading={<ResolveTile label={e.description} />} title={e.description} sub={e.date} trailing={`${m.int}${m.dec} ${String(e.currency)}`} />
      })}
    </ResolveSheet>
  )
}
