'use client'

import { useMemo, useState } from 'react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { AmountField } from '@/components/ui/AmountField'
import { OptionChip } from '@/components/ui/OptionChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cashOut, setAside } from '@/lib/accounts/actions'
import type { AccountView } from '@/lib/accounts/useAccounts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { AccountPicker } from './AccountPicker'
import { SheetBody, SheetFooter } from '@/components/features/savings-v3/MoneySheetParts'
import { splitMoney } from './accountDisplay'

export type MoveMode = 'cash' | 'set'

interface MoveMoneySheetProps {
  open: boolean
  onClose: () => void
  accounts: AccountView[]
  initialAccountId: string
  initialMode: MoveMode
  initialAmount?: string
  onDone?: () => void
}

/** The only two moves made by hand: take cash out, or put money aside in a pocket. */
export function MoveMoneySheet({ open, onClose, accounts, initialAccountId, initialMode, initialAmount = '', onDone }: MoveMoneySheetProps) {
  const t = useT().accountsPage
  const pocketsAll = useFinanceStore((s) => s.savingsAccounts)
  const [mode, setMode] = useState<MoveMode>(initialMode)
  const [accountId, setAccountId] = useState(initialAccountId)
  const [amount, setAmount] = useState(initialAmount)
  const [pocketId, setPocketId] = useState<string | null>(null)

  const sources = useMemo(() => accounts.filter((a) => a.balance), [accounts])
  const account = sources.find((a) => a.method.id === accountId) ?? sources[0]
  const pockets = useMemo(() => pocketsAll.filter((p) => p.category === 'savings'), [pocketsAll])
  const pocket = pockets.find((p) => p.id === pocketId) ?? pockets[0]

  if (!account?.balance) return null
  const cur = String(account.method.currency)
  const fmt = (n: number) => splitMoney(n, cur).int + splitMoney(n, cur).dec
  const free = account.balance.free
  const v = parseFloat(amount) || 0
  const valid = v > 0 && v <= free && (mode === 'cash' || Boolean(pocket))
  const held = pocket?.heldInPaymentMethodId === account.method.id
  const info = v === 0 ? t.enterAmount : v > free ? t.moreThanFree(fmt(free))
    : mode === 'cash' ? t.becomes(account.method.name, fmt(account.balance.balance - v))
    : t.freeBecomes(fmt(free - v))

  const submit = () => {
    if (!valid) return
    if (mode === 'cash') cashOut(account.method.id, v, account.method.currency)
    else setAside(account.method.id, pocket!.id, v, account.method.currency)
    onDone?.()
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}><V3SheetHeader.Title>{mode === 'cash' ? t.cashOut : t.setAsideAction}</V3SheetHeader.Title></V3SheetHeader>
        <SheetBody>
          <SegmentedControl ariaLabel={t.cashOut} value={mode} onChange={setMode}
            options={[{ value: 'cash', label: t.cashOut }, { value: 'set', label: t.setAsideAction }]} />
          <AccountPicker accounts={sources} value={account.method.id} onChange={setAccountId} />
          {mode === 'cash' ? (
            <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{t.toCash}</p>
          ) : pockets.length === 0 ? (
            <p className="text-sm text-[var(--color-brand-text-muted)]">{t.noPockets}</p>
          ) : (
            <div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar" role="radiogroup" aria-label={t.setAsideAction}>
                {pockets.map((p) => <OptionChip key={p.id} selected={p.id === pocket?.id} onClick={() => setPocketId(p.id)}>{p.name}</OptionChip>)}
              </div>
              <p className="mt-2 text-xs text-[var(--color-brand-text-muted)]">{held ? t.staysInAccount : t.movesOut}</p>
            </div>
          )}
          <div>
            <AmountField value={amount} onChange={setAmount} currency={cur} placeholder="0" />
            <p className={`mt-2 min-h-[19px] text-[13px] ${v > free ? 'text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-text-secondary)]'}`}>{info}</p>
          </div>
        </SheetBody>
        <SheetFooter>
          <Button size="cta-block" onClick={submit} disabled={!valid} className="font-semibold">
            {mode === 'cash' ? t.withdraw(fmt(v)) : t.setAsideIn(fmt(v), pocket?.name ?? '')}
          </Button>
        </SheetFooter>
      </div>
    </ModalShell>
  )
}
