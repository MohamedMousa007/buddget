'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SheetBody, SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { Button } from '@/components/ui/button'
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
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{t.unplacedTitle(items.length)}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{t.unplacedSub}</V3SheetHeader.Subtitle>
        </V3SheetHeader>
        <SheetBody className="space-y-3 pt-3">
          <ul className="divide-y divide-[var(--color-brand-border)] rounded-2xl border border-[var(--color-brand-border)]">
            {items.map((e) => (
              <li key={e.id} className="flex min-h-12 items-center gap-3 px-3.5 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{e.description}</span>
                  <span className="block text-xs text-[var(--color-brand-text-muted)]">{e.date}</span>
                </span>
                <span className="font-mono-numbers text-sm">{splitMoney(e.amount, String(e.currency)).int}{splitMoney(e.amount, String(e.currency)).dec} {String(e.currency)}</span>
              </li>
            ))}
          </ul>
          <AccountPicker accounts={accounts} value={accountId} onChange={setPicked} label={t.unplacedAccount} />
        </SheetBody>
        <SheetFooter>
          <Button size="cta-block" onClick={attach} disabled={!accountId || items.length === 0} className="font-semibold">{t.unplacedAttach(items.length)}</Button>
        </SheetFooter>
      </div>
    </ModalShell>
  )
}
