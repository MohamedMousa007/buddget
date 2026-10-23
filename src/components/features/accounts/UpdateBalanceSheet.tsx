'use client'

import { useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { AmountField } from '@/components/ui/AmountField'
import { updateBalance } from '@/lib/accounts/actions'
import type { AccountView } from '@/lib/accounts/useAccounts'
import { useT } from '@/lib/i18n'
import { splitMoney } from './accountDisplay'

interface UpdateBalanceSheetProps {
  open: boolean
  onClose: () => void
  account: AccountView
}

/** "What does your bank show now?" The difference is recorded as an explicit adjustment, never an expense. */
export function UpdateBalanceSheet({ open, onClose, account }: UpdateBalanceSheetProps) {
  const t = useT().accountsPage
  const current = account.balance?.balance ?? 0
  const cur = String(account.method.currency)
  const fmt = (n: number) => splitMoney(n, cur).int + splitMoney(n, cur).dec
  const [value, setValue] = useState(String(current))
  const reported = parseFloat(value)
  const has = Number.isFinite(reported)
  const diff = has ? Math.round((reported - current) * 100) / 100 : 0

  const submit = () => {
    if (!has) return
    updateBalance(account.method.id, current, reported)
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{t.whatBankShows}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{account.method.name}{account.method.last4 ? ` •• ${account.method.last4}` : ''}</V3SheetHeader.Subtitle>
        </V3SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-3 pt-3">
          <AmountField value={value} onChange={setValue} currency={cur} placeholder="0" />
          <p className={`text-[13px] font-semibold ${diff === 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-amber)]'}`}>
            {diff === 0 ? t.matchesBuddget : t.vsBuddget(`${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}`)}
          </p>
          <p className="text-[13px] text-[var(--color-brand-text-muted)]">{t.buddgetHas(fmt(current))}</p>
        </div>
        <div className="px-5 pb-5 pt-2">
          <Button size="cta-block" onClick={submit} disabled={!has} className="font-semibold">
            {diff === 0 ? t.looksRight : t.setBalanceTo(fmt(reported))}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
