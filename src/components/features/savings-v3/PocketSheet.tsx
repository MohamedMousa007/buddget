'use client'

import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowDownToLine, ArrowUpRight, EllipsisVertical, House, Pencil, Plus, Trash2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { ModalShell } from '@/components/modals/ModalShell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { IconButton } from '@/components/ui/IconButton'
import { PickerRow } from '@/components/ui/PickerRow'
import { BAND_FG2, BAND_MIX, HeroBand } from '@/components/features/hero/HeroBand'
import { AccountNameValue } from '@/components/features/accounts/AccountPicker'
import { accountTitle } from '@/components/features/accounts/accountDisplay'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { PocketTile } from '@/components/features/savings-v3/MoneySheetParts'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useSavingsV9Copy } from '@/lib/i18n/savingsV9Copy'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { isMonthlySavingsPart } from '@/lib/savings/canDeletePocket'
import { pocketDisplayName } from '@/lib/savings/pocketIdentity'
import { pocketHome } from '@/lib/savings/pocketHome'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { SavingsAccount } from '@/lib/store/types'
import { formatWhole } from '@/lib/utils/formatters'

export interface PocketSheetProps {
  account: SavingsAccount
  onClose: () => void
  onAddMoney: (account: SavingsAccount) => void
  /** Money set aside in an account goes back to Free to spend. */
  onRelease: (account: SavingsAccount) => void
  /** Money held outside the accounts (gold, cash at home) leaves the pocket. */
  onWithdraw: (account: SavingsAccount) => void
  onEdit: (account: SavingsAccount) => void
  onDelete: (account: SavingsAccount) => void
}

/** One pocket (final-ui v9, a single item, so a sheet): its amount, Add money with Release or Withdraw, its moves and details; ⋮ Edit, Delete. */
export function PocketSheet({ account, onClose, onAddMoney, onRelease, onWithdraw, onEdit, onDelete }: PocketSheetProps) {
  const v9 = useSavingsV9Copy()
  const c = v9.pocket
  const sf = useT().savingsForms
  const { locale } = useLocale()
  const hidden = useMask('hero')
  const s = useFinanceStore(useShallow((st) => ({
    methods: st.paymentMethods, transactions: st.savingsTransactions,
  })))
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const home = pocketHome(account, s.methods)
  const holder = home.kind === 'reserved' ? s.methods.find((m) => m.id === home.accountId) : undefined
  const system = isMonthlySavingsPart(account)
  const name = pocketDisplayName(account, sf.systemNames)
  const unit = account.currency === 'XAU' ? 'g' : account.currency
  const moves = useMemo(
    () => s.transactions.filter((t) => t.accountId === account.id).sort((a, b) => (b.occurredAt ?? b.date).localeCompare(a.occurredAt ?? a.date)).slice(0, 5),
    [s.transactions, account.id],
  )

  const details: Array<[string, React.ReactNode]> = [
    [c.keptIn, holder ? <AccountNameValue method={holder} /> : <span>{v9.page.outside}</span>],
    [c.currency, unit],
    ...(account.createdAt ? [[c.created, formatLocalized(new Date(account.createdAt), 'MMM yyyy', locale)] as [string, React.ReactNode]] : []),
  ]

  return (
    <>
      <ModalShell open onBackdropClick={onClose} scrollChild>
        <div className="flex min-h-0 flex-1 flex-col">
          <V3SheetHeader
            onClose={onClose}
            actions={
              <IconButton variant="sheetAction" aria-label={c.more} aria-haspopup="menu" aria-expanded={menu !== null}
                onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>
                <EllipsisVertical className="size-4" />
              </IconButton>
            }
          >
            <V3SheetHeader.Title size="compact">{name}</V3SheetHeader.Title>
            <V3SheetHeader.Subtitle>{system ? c.subSystem : c.subNoTarget}</V3SheetHeader.Subtitle>
          </V3SheetHeader>

          <div className="native-scroll flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-6 pt-2 md:px-6 [&>*]:shrink-0">
            <HeroBand
              contained
              label={c.inThisPocket}
              aside={<PocketTile account={account} className="size-8 rounded-[10px]" iconClassName="size-4" />}
              numbers={
                <p className="flex min-w-0 items-baseline gap-1.5">
                  <span className="font-mono-numbers text-[32px] font-semibold leading-none tracking-[-0.04em]">{hidden ? MASK : formatWhole(account.currentBalance)}</span>
                  <span className={`text-[0.8125rem] font-semibold ${BAND_FG2}`}>{unit}</span>
                </p>
              }
              note={
                <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 text-[0.78125rem] font-semibold text-[var(--flow-band-fg)]" style={{ background: BAND_MIX }}>
                  {holder ? c.setAsideIn(accountTitle(holder)) : <><House className="size-3.5" aria-hidden />{v9.page.outside}</>}
                </span>
              }
            />

            <div>
              <div className="grid grid-cols-2 gap-2">
                <Button size="touch" onClick={() => onAddMoney(account)}><Plus />{c.addMoney}</Button>
                <Button size="touch" variant="secondary" onClick={() => (holder ? onRelease(account) : onWithdraw(account))}>
                  {holder ? <ArrowDownToLine /> : <ArrowUpRight />}{holder ? c.release : c.withdraw}
                </Button>
              </div>
              {holder ? <p className="mt-2 px-1 text-xs text-[var(--color-brand-text-muted)]">{c.releaseHint(accountTitle(holder))}</p> : null}
            </div>

            {moves.length > 0 ? (
              <div>
                <h3 className="mb-2 px-1 text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">{c.recentMoves}</h3>
                <Card padding="none" divide className="overflow-hidden">
                  {moves.map((tx) => {
                    const into = tx.type === 'deposit'
                    return (
                      <TransactionRow
                        key={tx.id}
                        icon={into ? <ArrowDownLeft className="size-5" aria-hidden /> : <ArrowUpRight className="size-5" aria-hidden />}
                        iconBg={into ? 'color-mix(in oklab, var(--color-brand-green) 16%, transparent)' : undefined}
                        iconFg={into ? 'var(--color-brand-green)' : 'var(--color-brand-text-secondary)'}
                        title={tx.notes || (into ? c.moveIn : c.moveOut)}
                        subtitle={formatLocalized(new Date(tx.occurredAt ?? `${tx.date.slice(0, 10)}T12:00:00`), 'MMM d', locale)}
                        amount={hidden ? MASK : <>{into ? '+' : '−'}{formatWhole(tx.amount)} <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{tx.currency === 'XAU' ? 'g' : tx.currency}</span></>}
                        amountColor={into ? 'var(--color-brand-green)' : undefined}
                      />
                    )
                  })}
                </Card>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 px-1 text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">{c.details}</h3>
              <Card padding="none" divide className="overflow-hidden">
                {details.map(([k, v]) => <PickerRow key={k} label={k} value={v} />)}
              </Card>
              <p className="mt-2 px-1 text-xs leading-relaxed text-[var(--color-brand-text-muted)]">
                {holder ? c.noteIn(accountTitle(holder)) : c.noteOut}{system ? ` ${c.noteSystem}` : ''}
              </p>
            </div>
          </div>
        </div>
      </ModalShell>
      <CardActionMenu
        anchor={menu}
        onClose={() => setMenu(null)}
        zClassName="z-[120]"
        items={[
          { label: c.edit, icon: <Pencil className="size-4" />, onSelect: () => onEdit(account) },
          { label: c.delete, icon: <Trash2 className="size-4" />, destructive: true, disabled: system, hint: system ? c.cantDelete : undefined, onSelect: () => onDelete(account) },
        ]}
      />
    </>
  )
}
