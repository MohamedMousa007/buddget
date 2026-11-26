'use client'

import { createElement, useMemo, useState } from 'react'
import { Banknote, Coins, Landmark, MoreVertical, Pencil, Plus, Trash2, WalletCards } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { IconButton } from '@/components/ui/IconButton'
import { Switch } from '@/components/ui/switch'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { cardsToFollow, changeAccountCurrency, closeAccount, ensureCashAccount, followsAccountCurrency, updateBalance } from '@/lib/accounts/actions'
import { computeBalances } from '@/lib/accounts/balance'
import { allowsNegativeBalance, editedBalance } from '@/lib/accounts/balanceEdit'
import { sheetActivity } from '@/lib/accounts/cardDetails'
import { DEFAULT_CASH_ID, canBeParent } from '@/lib/accounts/kinds'
import { useLedgerInput, type AccountView } from '@/lib/accounts/useAccounts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, PaymentMethod } from '@/lib/store/types'
import { useCashCurrencyCopy } from '@/lib/i18n/cashCurrencyCopy'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { MASK } from '@/lib/privacy/mask'
import { UsageMeter } from '@/components/features/usage/UsageMeter'
import { useBalanceView } from '@/lib/accounts/useBalanceView'
import { useUsageCopy } from '@/lib/i18n/usageCopy'
import { clock } from '@/lib/usage/format'
import { useLocale, useT } from '@/lib/i18n'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { cn } from '@/lib/utils'
import { accountColor, accountTitle, cardKindLabel, moneyFlex, splitMoney } from './accountDisplay'
import { BrandMark } from './BrandMark'
import { CardFaceChip } from './CardFaceChip'
import { InlineBalanceEdit, type BalanceDraft } from './InlineBalanceEdit'
import { SheetActivity } from './SheetActivity'
import { UnsavedChangesDialog } from '@/components/features/expenses/UnsavedChangesDialog'
import type { MoveMode } from './MoveMoneySheet'

interface AccountDetailSheetProps {
  open: boolean
  onClose: () => void
  account: AccountView
  masked: boolean
  onMove: (mode: MoveMode) => void
  onAddCard: () => void
  /** Edit the account (for Cash: change its currency). */
  onEdit: () => void
  /** One of the account's cards, in its own sheet. */
  onOpenCard: (card: PaymentMethod) => void
  /** "See all" on the cards row: every card of this account as a list (the provider page). */
  onSeeAllCards?: () => void
  /** The unexplained difference the SMS found (amber line); opens the fix sheet. */
  gap?: number
  onFix?: () => void
  /** After a typed balance is saved (the page snoozes an open gap). */
  onBalanceSaved?: () => void
  /** A card sheet or the card form is stacked over this one. */
  behind?: boolean
}

const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime() }

const SECTION = 'text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]'

/**
 * One account, top to bottom (Light touch): the balance with its currency, Cash out · Set aside · Add card, the SMS
 * check, the cards row, the month, the default switch, Recent. Tapping the figure or the currency corrects it.
 */
export function AccountDetailSheet({ open, onClose, account, masked, onMove, onAddCard, onEdit, onOpenCard, onSeeAllCards, gap, onFix, onBalanceSaved, behind }: AccountDetailSheetProps) {
  const tAll = useT()
  const { locale } = useLocale()
  const t = tAll.accountsPage
  const lt = useAccountsLtCopy().account
  const confirm = useConfirm()
  const cashCopy = useCashCurrencyCopy()
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)
  const expenses = useFinanceStore((s) => s.expenses)
  const methods = useFinanceStore((s) => s.paymentMethods)
  const ledger = useLedgerInput()
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null)
  const { method, balance, cards } = account
  const [draft, setDraft] = useState<BalanceDraft | null>(balance ? null : { value: '', negative: false })
  const [footerEl, setFooterEl] = useState<HTMLDivElement | null>(null)
  /** A currency change waiting on "Change N cards too?". */
  const [pending, setPending] = useState<{ value: number; currency: Currency; cards: PaymentMethod[] } | null>(null)
  const cur = String(method.currency)
  const isCash = method.type === 'cash'
  const isPrepaid = method.type === 'prepaid_card'
  const parentKind = canBeParent(method.type)
  const uc = useUsageCopy().balance
  const live = useBalanceView(method.id, open, isCash)
  const fmt = (n: number) => (masked ? MASK : moneyFlex(n, cur))
  const reported = draft ? editedBalance(draft.value, draft.negative, method.type) : null
  // The built-in Cash's seeded mark is not a choice (BUD-87): only a real Cash row reads as the default.
  const isDefault = method.isDefault && method.id !== DEFAULT_CASH_ID

  const month = useMemo(() => (open && balance ? computeBalances({ ...ledger, flowsFrom: monthStart() }).get(method.id) : undefined), [open, balance, ledger, method.id])
  const activity = useMemo(() => sheetActivity(undefined, method.id, expenses, methods), [expenses, methods, method.id])

  const commit = (value: number, currency?: Currency, cardIds: readonly string[] = []) => {
    if (currency) {
      changeAccountCurrency(method.id, currency, value, { cardIds })
      if (!balance) updateBalance(method.id, 0, value)
    } else updateBalance(method.id, balance?.balance ?? 0, value)
    onBalanceSaved?.()
    // The Cash placeholder becomes a real account with its own id; this sheet's account is gone.
    if (method.id === DEFAULT_CASH_ID) onClose()
  }
  const save = (value: number, currency?: string) => {
    const followers = currency ? cardsToFollow(methods, method.id, currency as Currency) : []
    if (currency && followers.length) setPending({ value, currency: currency as Currency, cards: followers })
    else commit(value, currency as Currency | undefined)
  }
  const answer = (withCards: boolean) => {
    if (!pending) return
    setPending(null)
    commit(pending.value, pending.currency, withCards ? pending.cards.map((c) => c.id) : [])
  }
  // Dismissed: back to the sheet with the typed figure and currency still there.
  const keepEditing = () => {
    if (!pending) return
    setDraft({ value: String(Math.abs(pending.value)), negative: pending.value < 0, currency: pending.currency })
    setPending(null)
  }
  const setDefault = (on: boolean) => {
    if (on) updatePaymentMethod(isCash ? ensureCashAccount() : method.id, { isDefault: true })
    else updatePaymentMethod(method.id, { isDefault: false })
  }

  const manageItems = [
    isCash ? { label: cashCopy.menuItem, icon: <Coins size={17} />, onSelect: onEdit } : { label: tAll.paymentMethods.edit, icon: <Pencil size={17} />, onSelect: onEdit },
    ...(isCash ? [] : [{
      label: t.closeAccount, icon: <Trash2 size={17} />, destructive: true,
      onSelect: async () => {
        if (!(await confirm({ title: t.closeAccount, body: t.closeAccountBody(cards.length), confirmLabel: t.closeAccount, cancelLabel: t.keepOpen, destructive: true }))) return
        closeAccount(method.id)
        onClose()
      },
    }]),
  ]

  const heldPct = balance && balance.balance > 0 ? Math.min(100, (balance.held / balance.balance) * 100) : 0
  const smsMatches = live.data && balance ? Math.abs(balance.balance - live.data.balance) <= Math.max(1, Math.abs(live.data.balance) * 0.005) : false
  const editing = draft !== null
  const actions = [
    ...(isCash || isPrepaid ? [] : [{ key: 'cash', icon: <Banknote aria-hidden />, label: t.cashOut, onClick: () => onMove('cash'), disabled: !balance }]),
    { key: 'set', icon: <Landmark aria-hidden />, label: t.setAsideAction, onClick: () => onMove('set'), disabled: !balance },
    ...(parentKind ? [{ key: 'card', icon: <WalletCards aria-hidden />, label: lt.addCard, onClick: onAddCard, disabled: false }] : []),
  ]
  // The user's Name (the label) leads; the provider stands in for it, its digits in the line under it.
  const title = isCash ? t.typeCash : method.label?.trim() || accountTitle(method)
  const kind = isCash ? null : cardKindLabel(method.type, t)

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild behind={behind} panelClassName={parentKind ? 'h-[min(88dvh,760px)]' : ''}>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}
          leading={<BrandMark name={accountTitle(method)} color={isCash ? 'var(--color-brand-sunken)' : accountColor(method)} size={36} alert={!!gap}
            logo={isCash ? null : bankLogoForName(accountTitle(method))} icon={isCash ? createElement(paymentTypeIcon('cash'), { className: 'size-5', 'aria-hidden': true }) : undefined} />}
          actions={
            <IconButton aria-label={tAll.common.moreActions} aria-haspopup="menu" aria-expanded={menuAnchor !== null} variant="sheetAction" onClick={(e) => setMenuAnchor(e.currentTarget.getBoundingClientRect())}>
              <MoreVertical size={16} />
            </IconButton>
          }>
          <V3SheetHeader.Title>{title}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{[kind, method.last4 ? `\u2022\u2022${method.last4}` : null, cur].filter(Boolean).join(' \u00b7 ')}</V3SheetHeader.Subtitle>
        </V3SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y pb-5 pt-2">
          <div className="px-5 pb-1 pt-2">
            <InlineBalanceEdit look="hero" current={balance ? balance.balance : null} currency={cur} masked={masked} draft={draft} onDraftChange={setDraft}
              reported={reported} onSave={save} allowNegative={allowsNegativeBalance(method.type)}
              caption={isCash ? lt.cashCaption : undefined} hint={isCash ? lt.cashHint : lt.hint}
              currencyEditable={!isCash} onCurrencyClick={isCash ? onEdit : undefined}
              badge={balance && balance.balance < 0 ? <Badge variant="warning">{t.overdrawn}</Badge> : null} footerTarget={footerEl} />
            {!editing && balance && balance.held > 0 ? (
              <div className="mt-4">
                <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--color-brand-sunken)]" aria-hidden>
                  <span className="h-full rounded-full bg-[var(--color-brand-primary)]" style={{ width: `${100 - heldPct}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-[var(--color-brand-text-secondary)]">
                  <span><b className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">{fmt(balance.free)}</b> {lt.free}</span>
                  <span><b className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">{fmt(balance.held)}</b> {t.setAsideLabel}</span>
                </div>
              </div>
            ) : null}
          </div>

          <div className={cn('grid gap-2 px-4', actions.length === 3 ? 'grid-cols-3' : actions.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
            {actions.map((x) => (
              <Button key={x.key} variant="outline" className="h-11 gap-1.5 rounded-full px-2 text-[0.84375rem] font-semibold [&_svg]:size-4" onClick={x.onClick} disabled={x.disabled}>{x.icon}{x.label}</Button>
            ))}
          </div>

          {!isCash && gap ? (
            <div className="mx-4 flex items-center gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--color-brand-amber)_35%,transparent)] bg-[var(--color-brand-elevated)] py-2.5 pe-2 ps-3.5">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--color-brand-amber)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--color-brand-text-primary)]">{(gap > 0 ? t.extraTitle : t.missingTitle)(fmt(Math.abs(gap)))}</span>
                <span className="block text-xs text-[var(--color-brand-text-muted)]">{gap > 0 ? t.extraSub : t.missingSub}</span>
              </span>
              {onFix ? <Button variant="secondary" size="touch" onClick={onFix}>{gap > 0 ? t.whereDidItComeFrom : t.whereDidItGo}</Button> : null}
            </div>
          ) : live.data ? (
            <div className={cn('mx-4 space-y-2 rounded-2xl bg-[var(--color-brand-elevated)] px-3.5 py-3', !smsMatches && 'border border-[color-mix(in_oklab,var(--color-brand-amber)_35%,transparent)]')}>
              <div className="flex items-center gap-3">
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', smsMatches ? 'bg-[var(--color-brand-green)]' : 'bg-[var(--color-brand-amber)]')} />
                <span className="min-w-0 flex-1">
                  <span dir="auto" className="block text-sm font-semibold text-[var(--color-brand-text-primary)]">{smsMatches ? t.smsMatch : t.smsShows(fmt(live.data.balance))}</span>
                  <span dir="auto" className="block text-xs text-[var(--color-brand-text-muted)]">
                    {smsMatches ? lt.smsSaid(clock(live.data.reportedAt, locale), fmt(live.data.balance)) : uc.from(clock(live.data.reportedAt, locale))}
                  </span>
                </span>
                {!smsMatches && !masked ? (
                  <Button variant="secondary" size="touch" onClick={() => setDraft({ value: String(Math.abs(live.data!.balance)), negative: live.data!.balance < 0 })}>
                    {t.useAmount(splitMoney(live.data.balance, cur).int)}
                  </Button>
                ) : null}
              </div>
              {live.data.limit !== null && live.data.used >= 8 ? (
                <UsageMeter kind="count" label={uc.title} used={live.data.used} limit={live.data.limit} value={uc.usedOf(live.data.used, live.data.limit)} />
              ) : live.data.limit !== null && live.data.used >= 7 ? (
                <p dir="auto" className="text-xs text-[var(--color-brand-amber)]">{uc.left(live.data.limit - live.data.used)}</p>
              ) : null}
            </div>
          ) : live.blocked ? (
            <p dir="auto" role="status" className="mx-4 rounded-2xl bg-[var(--color-brand-elevated)] p-3.5 text-xs text-[var(--color-brand-text-secondary)]">{uc.blocked}</p>
          ) : null}

          {parentKind || isPrepaid ? (
            <section>
              <div className="mx-5 mb-1 mt-4 flex min-h-11 items-center justify-between">
                <h3 className={SECTION}>{isPrepaid ? t.typePrepaid : lt.cards(cards.length)}</h3>
                {parentKind && cards.length > 0 && onSeeAllCards ? (
                  <Button variant="link" className="h-11 px-1 text-[0.8125rem] font-semibold" onClick={onSeeAllCards}>{lt.seeAll}</Button>
                ) : null}
              </div>
              <div className="relative">
                <div dir="ltr" className="native-scroll flex snap-x items-center gap-2 overflow-x-auto scroll-px-5 px-5 py-1">
                  {isPrepaid ? <CardFaceChip method={method} /> : cards.map((c) => {
                    const otherCurrency = followsAccountCurrency(c) && c.currency !== method.currency
                    return (
                      <button key={c.id} type="button" data-raw-button-ok="a card face is its own tap target" onClick={() => onOpenCard(c)}
                        aria-label={[accountTitle(method), c.last4, otherCurrency ? lt.differentCurrency : null].filter(Boolean).join(' ')}
                        className="flex min-h-14 shrink-0 snap-start flex-col items-center gap-1 rounded-[9px] transition-transform duration-150 active:scale-[0.97] motion-reduce:transition-none">
                        <CardFaceChip method={c} parent={method} />
                        {otherCurrency ? <Badge variant="warning" size="xs" aria-hidden>{lt.differentCurrency}</Badge> : null}
                      </button>
                    )
                  })}
                  {parentKind ? (
                    <button type="button" data-raw-button-ok="the dashed add-card slot of the cards row" onClick={onAddCard} aria-label={t.addACard}
                      className="flex min-h-14 shrink-0 snap-start items-center gap-2.5 text-start">
                      <span className="flex h-14 w-[88px] items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] text-[var(--color-brand-text-muted)]">
                        <Plus className="size-5" aria-hidden />
                      </span>
                      {cards.length === 0 ? <span className="text-[0.78125rem] font-semibold text-[var(--color-brand-primary-ink)]">{t.addACard}</span> : null}
                    </button>
                  ) : null}
                </div>
                <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[var(--color-brand-card)] to-transparent" />
              </div>
            </section>
          ) : null}

          {month?.flowsIn !== undefined ? (
            <div className="mx-4 grid grid-cols-2 divide-x divide-[var(--color-brand-border)] rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] rtl:divide-x-reverse">
              <div className="px-3.5 py-3">
                <p className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{t.inThisMonth}</p>
                <p dir="ltr" className="text-start font-mono-numbers text-base font-semibold tabular-nums text-[var(--color-brand-green)]">{masked ? MASK : month.flowsIn ? `+${moneyFlex(month.flowsIn, cur)}` : '0'}</p>
              </div>
              <div className="px-3.5 py-3">
                <p className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{t.outThisMonth}</p>
                <p dir="ltr" className="text-start font-mono-numbers text-base font-semibold tabular-nums text-[var(--color-brand-text-primary)]">{masked ? MASK : month.flowsOut ? `\u2212${moneyFlex(month.flowsOut, cur)}` : '0'}</p>
              </div>
            </div>
          ) : null}

          <Card padding="none" className="mx-4 overflow-hidden rounded-2xl">
            <div className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">{lt.defaultTitle}</span>
                <span className="mt-0.5 block text-xs text-[var(--color-brand-text-secondary)] [text-wrap:pretty]">{lt.defaultSub}</span>
              </span>
              <Switch size="touch" aria-label={lt.defaultTitle} checked={isDefault} onCheckedChange={setDefault} />
            </div>
          </Card>

          <SheetActivity title={t.recent} rows={activity} masked={masked} method={method} emptyLine={t.emptyAccountActivity} onLeave={onClose} />
        </div>
        <div ref={setFooterEl} className="shrink-0" />
      </div>
      <CardActionMenu anchor={menuAnchor} items={manageItems} onClose={() => setMenuAnchor(null)} zClassName="z-[110]" />
      <UnsavedChangesDialog open={pending !== null} title={pending ? lt.cardsFollowTitle(pending.cards.length, pending.currency) : undefined}
        body={lt.cardsFollowBody} saveLabel={lt.changeCardsToo} discardLabel={lt.onlyAccount} discardTone="neutral"
        onSave={() => answer(true)} onDiscard={() => answer(false)} onKeep={keepEditing}>
        <ul className="mt-3 space-y-1 text-sm font-medium text-[var(--color-brand-text-primary)]">
          {pending?.cards.map((c) => (
            <li key={c.id} dir="auto">{c.label?.trim() || `${accountTitle(method)} ${cardKindLabel(c.type, t)}`}{c.last4 ? <span dir="ltr" className="font-mono-numbers text-[var(--color-brand-text-muted)]"> {'\u2022\u2022'}{c.last4}</span> : null}</li>
          ))}
        </ul>
      </UnsavedChangesDialog>
    </ModalShell>
  )
}
