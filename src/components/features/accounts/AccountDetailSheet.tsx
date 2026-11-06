'use client'

import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { useMemo, useState } from 'react'
import { Banknote, MoreVertical, Pencil, PiggyBank, RefreshCw, ShoppingBag, Star, Trash2 } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { PaymentCardCarousel } from '@/components/features/payments/PaymentCardCarousel'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { IconButton } from '@/components/ui/IconButton'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { closeAccount, ensureCashAccount } from '@/lib/accounts/actions'
import { instantOf } from '@/lib/accounts/balance'
import { canBeParent } from '@/lib/accounts/kinds'
import { resolveAccountId } from '@/lib/accounts/resolve'
import type { AccountView } from '@/lib/accounts/useAccounts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { MASK } from '@/lib/privacy/mask'
import { useT } from '@/lib/i18n'
import { accountIdentifier, accountTitle, splitMoney } from './accountDisplay'
import type { MoveMode } from './MoveMoneySheet'

interface AccountDetailSheetProps {
  open: boolean
  onClose: () => void
  account: AccountView
  masked: boolean
  onMove: (mode: MoveMode) => void
  onUpdate: () => void
  onAddCard: () => void
  onEdit: () => void
}

/** One account, card first: its own cards, the balance split into free and set aside, three actions, activity. */
export function AccountDetailSheet({ open, onClose, account, masked, onMove, onUpdate, onAddCard, onEdit }: AccountDetailSheetProps) {
  const tAll = useT()
  const t = tAll.accountsPage
  const confirm = useConfirm()
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null)
  const expenses = useFinanceStore((s) => s.expenses)
  const methods = useFinanceStore((s) => s.paymentMethods)
  const [active, setActive] = useState(0)
  const { method, balance, cards } = account
  const cur = String(method.currency)
  const card = cards[active]
  const fmt = (n: number) => (masked ? MASK : splitMoney(n, cur).int + splitMoney(n, cur).dec)

  const activity = useMemo(() => {
    const mine = expenses.filter((e) => (card ? e.paymentMethodId === card.id : resolveAccountId(e.paymentMethodId, methods) === method.id) && !e.refundedAt)
    return mine.sort((a, b) => instantOf(b.occurredAt, b.date) - instantOf(a.occurredAt, a.date)).slice(0, 5)
  }, [expenses, methods, card, method.id])

  const isCash = method.type === 'cash'
  const manageItems = [
    ...(isCash ? [] : [{ label: tAll.paymentMethods.edit, icon: <Pencil size={17} />, onSelect: onEdit }]),
    ...(method.isDefault ? [] : [{ label: tAll.paymentMethods.setDefault, icon: <Star size={17} />, onSelect: () => updatePaymentMethod(isCash ? ensureCashAccount() : method.id, { isDefault: true }) }]),
    ...(isCash ? [] : [{
      label: t.closeAccount, icon: <Trash2 size={17} />, destructive: true,
      onSelect: async () => {
        if (!(await confirm({ title: t.closeAccount, body: t.closeAccountBody(cards.length), destructive: true }))) return
        closeAccount(method.id)
        onClose()
      },
    }]),
  ]

  const heldPct = balance && balance.balance > 0 ? Math.min(100, (balance.held / balance.balance) * 100) : 0
  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{accountTitle(method)}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{[accountIdentifier(method), String(method.currency)].filter(Boolean).join(' · ')}</V3SheetHeader.Subtitle>
          {manageItems.length > 0 ? (
            <V3SheetHeader.Extra>
              <IconButton aria-label={tAll.common.moreActions} variant="tinted" onClick={(e) => setMenuAnchor(e.currentTarget.getBoundingClientRect())}>
                <MoreVertical size={18} />
              </IconButton>
            </V3SheetHeader.Extra>
          ) : null}
        </V3SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-3 pt-2">
          {canBeParent(method.type) ? (
            <div className="px-5">
              {cards.length > 0 ? (
                <PaymentCardCarousel methods={cards} active={active} onActiveChange={setActive} defaultLabel="" hint="" onAddCard={onAddCard} addLabel={t.addACard} />
              ) : (
                <Button variant="outline" size="cta-block" onClick={onAddCard}>{t.addACard}</Button>
              )}
            </div>
          ) : null}
          {balance ? (
            <div className="px-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[0.8125rem] font-semibold text-[var(--color-brand-text-secondary)]">{t.balance}</p>
                  <p className="font-mono-numbers text-[36px] font-semibold leading-[1.05] tracking-[-0.04em] text-[var(--color-brand-text-primary)]">{fmt(balance.balance)}</p>
                </div>
                {balance.balance < 0 ? <Badge variant="warning">{t.overdrawn}</Badge> : null}
              </div>
              {balance.held > 0 ? (
                <>
                  <div className="mt-3.5 flex h-1.5 overflow-hidden rounded-full bg-[var(--color-brand-sunken)]" aria-hidden>
                    <span className="h-full bg-[var(--color-brand-primary)]" style={{ width: `${100 - heldPct}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-[0.8125rem]">
                    <span><b className="font-mono-numbers">{fmt(balance.free)}</b> <span className="text-[var(--color-brand-text-secondary)]">{t.freeToSpend}</span></span>
                    <span><b className="font-mono-numbers">{fmt(balance.held)}</b> <span className="text-[var(--color-brand-text-secondary)]">{t.setAsideLabel}</span></span>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-2 px-5">
            <Button variant="secondary" size="cta-block" className="h-14 flex-col gap-1 text-xs" onClick={() => onMove('cash')} disabled={!balance}><Banknote aria-hidden />{t.cashOut}</Button>
            <Button variant="secondary" size="cta-block" className="h-14 flex-col gap-1 text-xs" onClick={() => onMove('set')} disabled={!balance}><PiggyBank aria-hidden />{t.setAsideAction}</Button>
            <Button variant="secondary" size="cta-block" className="h-14 flex-col gap-1 text-xs" onClick={onUpdate}><RefreshCw aria-hidden />{t.update}</Button>
          </div>
          <div>
            <p className="mb-1 px-5 text-[0.8125rem] font-bold text-[var(--color-brand-text-secondary)]">{card ? t.spentWith(accountTitle(card)) : t.recent}</p>
            {activity.length === 0 ? (
              <p className="px-5 py-3 text-sm text-[var(--color-brand-text-muted)]">{t.noActivity}</p>
            ) : activity.map((e) => (
              <TransactionRow key={e.id} icon={<ShoppingBag className="size-5" aria-hidden />} title={e.description || categoryLabel(tAll, e.category)}
                subtitle={new Date(instantOf(e.occurredAt, e.date)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                amount={masked ? MASK : `−${splitMoney(e.amount, String(e.currency)).int}`} />
            ))}
          </div>
        </div>
      </div>
      <CardActionMenu anchor={menuAnchor} items={manageItems} onClose={() => setMenuAnchor(null)} zClassName="z-[110]" />
    </ModalShell>
  )
}
