'use client'

import { categoryLabel } from '@/lib/i18n/categoryLabel'
import { useMemo, useState } from 'react'
import { Banknote, Coins, MoreVertical, Pencil, PiggyBank, RefreshCw, ShoppingBag, Star, Trash2 } from 'lucide-react'
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
import { cardDetails, sheetActivity } from '@/lib/accounts/cardDetails'
import { canBeParent } from '@/lib/accounts/kinds'
import type { AccountView } from '@/lib/accounts/useAccounts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { useCashCurrencyCopy } from '@/lib/i18n/cashCurrencyCopy'
import { MASK } from '@/lib/privacy/mask'
import { UsageMeter } from '@/components/features/usage/UsageMeter'
import { useBalanceView } from '@/lib/accounts/useBalanceView'
import { useUsageCopy } from '@/lib/i18n/usageCopy'
import { clock } from '@/lib/usage/format'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
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
  /** Edit the account (for Cash: change its currency). */
  onEdit: () => void
  /** Edit one of the account's cards (the setup sheet in edit mode). */
  onEditCard: (cardId: string) => void
}

/** One account, card first: its own cards, the balance split into free and set aside, three actions, activity. */
export function AccountDetailSheet({ open, onClose, account, masked, onMove, onUpdate, onAddCard, onEdit, onEditCard }: AccountDetailSheetProps) {
  const tAll = useT()
  const { locale } = useLocale()
  const t = tAll.accountsPage
  const confirm = useConfirm()
  const cashCopy = useCashCurrencyCopy()
  const setEditingExpenseId = useSettingsStore((s) => s.setEditingExpenseId)
  const setActiveModal = useSettingsStore((s) => s.setActiveModal)
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)
  const deletePaymentMethod = useFinanceStore((s) => s.deletePaymentMethod)
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null)
  const [cardMenu, setCardMenu] = useState<{ id: string; anchor: DOMRect } | null>(null)
  const expenses = useFinanceStore((s) => s.expenses)
  const methods = useFinanceStore((s) => s.paymentMethods)
  const debts = useFinanceStore((s) => s.debts)
  const debtPayments = useFinanceStore((s) => s.debtPayments)
  const rates = useFinanceStore((s) => s.exchangeRates)
  const { method, balance, cards } = account
  // The selection belongs to one account: opening another starts on its first card (BUD-103).
  const [selected, setSelected] = useState({ accountId: method.id, index: 0 })
  const active = selected.accountId === method.id ? selected.index : 0
  const setActive = (index: number) => setSelected({ accountId: method.id, index })
  const cur = String(method.currency)
  const card = cards[active]
  const details = useMemo(() => (card ? cardDetails(card, debts, expenses, debtPayments, rates) : null), [card, debts, expenses, debtPayments, rates])
  const uc = useUsageCopy().balance
  const live = useBalanceView(method.id, open, method.type === 'cash')
  const fmt = (n: number) => (masked ? MASK : splitMoney(n, cur).int + splitMoney(n, cur).dec)

  // The list follows the card on the carousel, empty included; the add-card slot shows the whole account.
  const activity = useMemo(() => sheetActivity(card, method.id, expenses, methods), [expenses, methods, card, method.id])

  const isCash = method.type === 'cash'
  const manageItems = [
    isCash ? { label: cashCopy.menuItem, icon: <Coins size={17} />, onSelect: onEdit } : { label: tAll.paymentMethods.edit, icon: <Pencil size={17} />, onSelect: onEdit },
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

  // The same card actions as Profile → Cards, so both screens manage a card the same way.
  const menuCard = cardMenu ? cards.find((c) => c.id === cardMenu.id) ?? null : null
  const cardItems = menuCard ? [
    { label: tAll.paymentMethods.edit, icon: <Pencil size={17} />, onSelect: () => onEditCard(menuCard.id) },
    ...(menuCard.isDefault ? [] : [{ label: tAll.paymentMethods.setDefault, icon: <Star size={17} />, onSelect: () => updatePaymentMethod(menuCard.id, { isDefault: true }) }]),
    {
      label: tAll.paymentMethods.delete, icon: <Trash2 size={17} />, destructive: true,
      onSelect: async () => {
        if (!(await confirm({ title: tAll.paymentMethods.delete, body: tAll.paymentMethods.deleteCardBody, destructive: true }))) return
        deletePaymentMethod(menuCard.id)
        setActive(0)
      },
    },
  ] : []

  const heldPct = balance && balance.balance > 0 ? Math.min(100, (balance.held / balance.balance) * 100) : 0
  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild panelClassName={canBeParent(method.type) ? 'h-[min(88dvh,760px)]' : ''}>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{accountTitle(method)}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{[accountIdentifier(method), String(method.currency)].filter(Boolean).join(' · ')}</V3SheetHeader.Subtitle>
          {manageItems.length > 0 ? (
            <V3SheetHeader.Extra>
              <IconButton aria-label={tAll.common.moreActions} aria-haspopup="menu" aria-expanded={menuAnchor !== null} variant="tinted" onClick={(e) => setMenuAnchor(e.currentTarget.getBoundingClientRect())}>
                <MoreVertical size={18} />
              </IconButton>
            </V3SheetHeader.Extra>
          ) : null}
        </V3SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y pb-3 pt-2">
          {canBeParent(method.type) ? (
            <div className="px-5">
              {cards.length > 0 ? (
                <>
                <PaymentCardCarousel methods={cards} active={active} onActiveChange={setActive} defaultLabel="" hint="" onAddCard={onAddCard} addLabel={t.addACard} onMenu={(id, anchor) => setCardMenu({ id, anchor })} />
                {card && details ? (
                  <div dir="auto" aria-live="polite" className="mt-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5">
                    <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
                      {[tAll.paymentMethodTypes[card.type], card.label?.trim() || (card.last4 ? `•• ${card.last4}` : ''), String(card.currency)].filter(Boolean).join(' · ')}
                    </p>
                    {details.kind === 'debit' ? (
                      <p className="mt-1 text-xs text-[var(--color-brand-text-secondary)]">{t.usesBalance(accountTitle(method))}</p>
                    ) : details.kind === 'credit' && details.outstanding !== null ? (
                      <div className="mt-2 flex justify-between gap-3 text-[0.8125rem]">
                        <span><span className="text-[var(--color-brand-text-secondary)]">{t.cardOutstanding}</span> <b dir="ltr" className="font-mono-numbers">{masked ? MASK : splitMoney(details.outstanding, details.currency).int}</b></span>
                        {details.limit !== null ? (
                          <span><span className="text-[var(--color-brand-text-secondary)]">{t.cardLimit}</span> <b dir="ltr" className="font-mono-numbers">{masked ? MASK : splitMoney(details.limit, details.currency).int}</b></span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                </>
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
                {balance.balance < 0 ? <Badge variant="warning">{t.overdrawn}</Badge> : method.type === 'cash' ? <Badge variant="muted">{t.cashEstimate}</Badge> : null}
              </div>
              {method.type === 'cash' ? <p className="mt-1 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{t.cashEstimateHint}</p> : null}
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
          {live.data ? (
            <div className="mx-5 space-y-2 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5">
              <div dir="auto" className="flex items-baseline justify-between gap-3">
                <p className="text-[0.8125rem] font-semibold text-[var(--color-brand-text-secondary)]">{uc.title}</p>
                <p dir="ltr" className="font-mono-numbers text-lg font-semibold text-[var(--color-brand-text-primary)]">{masked ? MASK : fmt(live.data.balance)}</p>
              </div>
              <p dir="auto" className="text-xs text-[var(--color-brand-text-secondary)]">{uc.from(clock(live.data.reportedAt, locale))}</p>
              {balance && !masked ? (
                <p dir="auto" className="text-xs font-semibold text-[var(--color-brand-text-primary)]">
                  {Math.abs(balance.balance - live.data.balance) <= Math.max(1, Math.abs(live.data.balance) * 0.005) ? uc.matches : uc.differs(fmt(Math.abs(balance.balance - live.data.balance)))}
                </p>
              ) : null}
              {live.data.limit !== null && live.data.used >= 8 ? (
                <UsageMeter kind="count" label={uc.title} used={live.data.used} limit={live.data.limit} value={uc.usedOf(live.data.used, live.data.limit)} />
              ) : live.data.limit !== null && live.data.used >= 7 ? (
                <p dir="auto" className="text-xs text-[var(--color-brand-amber)]">{uc.left(live.data.limit - live.data.used)}</p>
              ) : null}
            </div>
          ) : live.blocked ? (
            <p dir="auto" role="status" className="mx-5 rounded-2xl bg-[var(--color-brand-elevated)] p-3.5 text-xs text-[var(--color-brand-text-secondary)]">{uc.blocked}</p>
          ) : null}
          <div className="grid grid-cols-3 gap-2 px-5">
            <Button variant="secondary" size="cta-block" className="h-14 flex-col gap-1 text-xs" onClick={() => onMove('cash')} disabled={!balance}><Banknote aria-hidden />{t.cashOut}</Button>
            <Button variant="secondary" size="cta-block" className="h-14 flex-col gap-1 text-xs" onClick={() => onMove('set')} disabled={!balance}><PiggyBank aria-hidden />{t.setAsideAction}</Button>
            <Button variant="secondary" size="cta-block" className="h-14 flex-col gap-1 text-xs" onClick={onUpdate}><RefreshCw aria-hidden />{t.update}</Button>
          </div>
          <div>
            <p className="mb-1 px-5 text-[0.8125rem] font-bold text-[var(--color-brand-text-secondary)]">{card ? t.spentWith(accountTitle(card)) : t.recent}</p>
            {activity.length === 0 ? (
              <p className="px-5 py-3 text-sm text-[var(--color-brand-text-muted)]">{card ? t.noCardActivity : t.noActivity}</p>
            ) : activity.map((e) => (
              <TransactionRow key={e.id} icon={<ShoppingBag className="size-5" aria-hidden />} title={e.description || categoryLabel(tAll, e.category)}
                onClick={() => { onClose(); setEditingExpenseId(e.id); setActiveModal('editExpense') }}
                subtitle={formatLocalized(new Date(instantOf(e.occurredAt, e.date)), 'MMM d', locale)}
                amount={masked ? MASK : `−${splitMoney(e.amount, String(e.currency)).int}`} />
            ))}
          </div>
        </div>
      </div>
      <CardActionMenu anchor={menuAnchor} items={manageItems} onClose={() => setMenuAnchor(null)} zClassName="z-[110]" />
      <CardActionMenu anchor={menuCard && cardMenu ? cardMenu.anchor : null} items={cardItems} onClose={() => setCardMenu(null)} zClassName="z-[110]"
        title={menuCard ? `${accountTitle(menuCard)}${menuCard.last4 ? ` ••${menuCard.last4}` : ''}` : undefined} />
    </ModalShell>
  )
}
