'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { Banknote, Landmark } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AmountHero } from '@/components/ui/AmountHero'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { HEADER_PILL } from '@/components/ui/PillButton'
import { PickerRow } from '@/components/ui/PickerRow'
import { PocketPickerField, PocketTile } from '@/components/features/savings-v3/MoneySheetParts'
import { useDiscardPrompt } from '@/components/features/savings-v3/useDiscardPrompt'
import type { PocketVM } from '@/components/features/savings-v3/types'
import { cashOut, defaultSetAsidePocketId, setAside } from '@/lib/accounts/actions'
import type { AccountView } from '@/lib/accounts/useAccounts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { localTodayISO } from '@/lib/utils/localDate'
import { manualOccurredAt } from '@/lib/time/occurredAt'
import { useFlowLtCopy } from '@/lib/i18n/flowLtCopy'
import { AccountNameValue, AccountPicker } from './AccountPicker'
import { BrandMark } from './BrandMark'
import { accountTitle, moneyFlex } from './accountDisplay'

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

/** The icon tile above a money sheet's amount (52px, the move's own tint). */
export function MoveIconTile({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden className="flex size-[52px] items-center justify-center rounded-2xl bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)] [&_svg]:size-6">
      {children}
    </span>
  )
}

/** Cash on hand's mark: the banknote on its green tile. */
export function CashOnHandMark({ size }: { size: number }) {
  return <BrandMark name="" color="var(--color-brand-green-soft)" size={size} icon={<Banknote className="size-[58%] text-[var(--color-brand-green)]" aria-hidden />} />
}

/**
 * The only two moves made by hand (Light touch): Cash out takes money from an account to Cash on hand; Set aside keeps
 * it in the account (fixed) and marks it for a pocket. Each is its own layout: date pill, amount, what changes, rows.
 */
export function MoveMoneySheet({ open, onClose, accounts, initialAccountId, initialMode, initialAmount = '', onDone }: MoveMoneySheetProps) {
  const all = useT()
  const t = all.accountsPage
  const c = useAccountsLtCopy().move
  const pocketsAll = useFinanceStore((s) => s.savingsAccounts)
  const mode = initialMode
  const [accountId, setAccountId] = useState(initialAccountId)
  const [amount, setAmount] = useState(initialAmount)
  const [pocketId, setPocketId] = useState<string | null>(null)
  const [date, setDate] = useState(() => localTodayISO())
  const [clock, setClock] = useState('')
  const timeLabel = useFlowLtCopy().expense.time

  const sources = useMemo(() => accounts.filter((a) => a.balance), [accounts])
  const account = sources.find((a) => a.method.id === accountId) ?? sources[0]
  const pockets = useMemo<PocketVM[]>(
    () => pocketsAll.filter((p) => p.category === 'savings').map((p) => ({ account: p, coverAmount: 0, goalsAmount: 0, goalLabel: '', isAuto: false })),
    [pocketsAll],
  )
  const pocketsHere = useMemo(() => pockets.map((p) => p.account), [pockets])
  const shownPocketId = pocketId ?? (account ? defaultSetAsidePocketId(pocketsHere, account.method.id) : null)
  const pocket = pocketsHere.find((p) => p.id === shownPocketId)
  // A prefilled amount (the SMS gap) is not typed data; anything the user changed is.
  const discard = useDiscardPrompt(amount !== initialAmount || pocketId !== null || clock !== '' || date !== localTodayISO(), onClose)

  if (!account?.balance) return null
  const cur = String(account.method.currency)
  const name = account.method.label?.trim() || accountTitle(account.method)
  const free = account.balance.free
  const v = parseFloat(amount) || 0
  const valid = v > 0 && v <= free && (mode === 'cash' || Boolean(pocket))
  const held = pocket?.heldInPaymentMethodId === account.method.id
  const line = v > free ? <span className="text-[var(--color-brand-amber)]">{t.moreThanFree(moneyFlex(free, cur))}</span>
    : mode === 'cash' ? t.becomes(name, moneyFlex(account.balance.balance - v, cur))
    : (held ? c.setAsideLine : c.movesLine)(name, moneyFlex(free - v, cur))
  const title = mode === 'cash' ? t.cashOut : pocket ? c.setAsideTitle(pocket.name) : t.setAsideAction

  const submit = () => {
    if (!valid) return
    // The picked time, else the current time (on the picked day), as the pill shows.
    const at = new Date(manualOccurredAt(date, clock))
    if (mode === 'cash') cashOut(account.method.id, v, account.method.currency, at)
    else setAside(account.method.id, pocket!.id, v, account.method.currency, at)
    onDone?.()
    onClose()
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      {discard.prompt}
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={discard.close}
          leading={<DatePickerField look="pill" className={HEADER_PILL} value={date} onChange={setDate} time={{ value: clock, onChange: setClock, label: timeLabel, defaultNow: true }} />}>
          <V3SheetHeader.Title><span className="sr-only">{title}</span></V3SheetHeader.Title>
        </V3SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pb-3">
          <AmountHero value={amount} onChange={setAmount} currency={cur} aria-label={title}
            top={mode === 'set' && pocket
              ? <span aria-hidden><PocketTile account={pocket} className="size-[52px] rounded-2xl" iconClassName="size-6" /></span>
              : <MoveIconTile>{mode === 'cash' ? <Banknote /> : <Landmark />}</MoveIconTile>}
            line={(
              <>
                <span dir="auto" className="mt-3 block text-base font-semibold text-[var(--color-brand-text-primary)]">{title}</span>
                <span dir="auto" className="mt-1.5 block text-xs text-[var(--color-brand-text-secondary)]">{line}</span>
              </>
            )} />
          <Card padding="none" divide className="mx-4 overflow-hidden rounded-2xl">
            {mode === 'cash' ? (
              <>
                <AccountPicker look="row" accounts={sources} value={account.method.id} onChange={setAccountId} label={t.from} zIndexClassName="z-[110]" />
                <PickerRow label={c.to} value={<><CashOnHandMark size={24} />{c.cashOnHand}</>} />
              </>
            ) : (
              <>
                <PickerRow label={t.from} value={<AccountNameValue method={account.method} />} />
                {pockets.length === 0
                  ? <PickerRow label={c.into} value={<span className="text-[var(--color-brand-text-muted)]">{t.noPockets}</span>} />
                  : <PocketPickerField look="row" pockets={pockets} value={pocket?.id ?? null} onChange={setPocketId} label={c.into} />}
              </>
            )}
          </Card>
        </div>
        <div className="shrink-0 border-t border-[var(--color-brand-border)] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <Button size="cta-block" onClick={submit} disabled={!valid} className="font-semibold">
            {mode === 'cash' ? t.withdraw(moneyFlex(v, cur)) : c.setAsideCta}
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
