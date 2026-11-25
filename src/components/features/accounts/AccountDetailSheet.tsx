'use client'

import { createElement, useMemo, useState } from 'react'
import { Banknote, Coins, CreditCard, MoreVertical, Pencil, Plus, Star, Trash2, Vault } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { IconButton } from '@/components/ui/IconButton'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { closeAccount, ensureCashAccount, updateBalance } from '@/lib/accounts/actions'
import { computeBalances } from '@/lib/accounts/balance'
import { allowsNegativeBalance, editedBalance } from '@/lib/accounts/balanceEdit'
import { sheetActivity } from '@/lib/accounts/cardDetails'
import { DEFAULT_CASH_ID, canBeParent } from '@/lib/accounts/kinds'
import { useLedgerInput, type AccountView } from '@/lib/accounts/useAccounts'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { PaymentMethod } from '@/lib/store/types'
import { useCashCurrencyCopy } from '@/lib/i18n/cashCurrencyCopy'
import { MASK } from '@/lib/privacy/mask'
import { UsageMeter } from '@/components/features/usage/UsageMeter'
import { useBalanceView } from '@/lib/accounts/useBalanceView'
import { useUsageCopy } from '@/lib/i18n/usageCopy'
import { clock } from '@/lib/usage/format'
import { useLocale, useT } from '@/lib/i18n'
import { paymentTypeIcon } from '@/lib/constants/categoryGrid'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { cn } from '@/lib/utils'
import { accountColor, accountIdentifier, accountTitle, moneyFlex, splitMoney } from './accountDisplay'
import { BrandMark } from './BrandMark'
import { CardFaceChip } from './CardFaceChip'
import { InlineBalanceEdit, type BalanceDraft } from './InlineBalanceEdit'
import { SheetActivity } from './SheetActivity'
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
  /** The unexplained difference the SMS found (amber line); opens the fix sheet. */
  gap?: number
  onFix?: () => void
  /** After a typed balance is saved (the page snoozes an open gap). */
  onBalanceSaved?: () => void
  /** A card sheet or the card form is stacked over this one. */
  behind?: boolean
}

const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime() }

/** One account: tap-to-edit balance, free vs set aside, the SMS check, its cards, three actions, the month, activity. */
export function AccountDetailSheet({ open, onClose, account, masked, onMove, onAddCard, onEdit, onOpenCard, gap, onFix, onBalanceSaved, behind }: AccountDetailSheetProps) {
  const tAll = useT()
  const { locale } = useLocale()
  const t = tAll.accountsPage
  const confirm = useConfirm()
  const cashCopy = useCashCurrencyCopy()
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)
  const expenses = useFinanceStore((s) => s.expenses)
  const methods = useFinanceStore((s) => s.paymentMethods)
  const ledger = useLedgerInput()
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null)
  const { method, balance, cards } = account
  const [draft, setDraft] = useState<BalanceDraft | null>(balance ? null : { value: '', negative: false })
  const cur = String(method.currency)
  const isCash = method.type === 'cash'
  const isPrepaid = method.type === 'prepaid_card'
  const parentKind = canBeParent(method.type)
  const uc = useUsageCopy().balance
  const live = useBalanceView(method.id, open, isCash)
  const fmt = (n: number) => (masked ? MASK : moneyFlex(n, cur))
  const reported = draft ? editedBalance(draft.value, draft.negative, method.type) : null

  const month = useMemo(() => (open && balance ? computeBalances({ ...ledger, flowsFrom: monthStart() }).get(method.id) : undefined), [open, balance, ledger, method.id])
  const activity = useMemo(() => sheetActivity(undefined, method.id, expenses, methods), [expenses, methods, method.id])

  const save = (value: number) => {
    updateBalance(method.id, balance?.balance ?? 0, value)
    onBalanceSaved?.()
    // The Cash placeholder becomes a real account with its own id; this sheet's account is gone.
    if (method.id === DEFAULT_CASH_ID) onClose()
  }

  const manageItems = [
    isCash ? { label: cashCopy.menuItem, icon: <Coins size={17} />, onSelect: onEdit } : { label: tAll.paymentMethods.edit, icon: <Pencil size={17} />, onSelect: onEdit },
    ...(method.isDefault ? [] : [{ label: tAll.paymentMethods.setDefault, icon: <Star size={17} />, onSelect: () => updatePaymentMethod(isCash ? ensureCashAccount() : method.id, { isDefault: true }) }]),
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
  const tiles = [
    ...(isCash || isPrepaid ? [] : [{ key: 'cash', icon: <Banknote aria-hidden />, label: t.cashOut, onClick: () => onMove('cash'), disabled: !balance }]),
    { key: 'set', icon: <Vault aria-hidden />, label: t.setAsideAction, onClick: () => onMove('set'), disabled: !balance },
    ...(parentKind ? [{ key: 'card', icon: <CreditCard aria-hidden />, label: t.addCardCta, onClick: onAddCard, disabled: false }] : []),
  ]
  const title = isCash ? t.typeCash : accountTitle(method)

  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild behind={behind} panelClassName={parentKind ? 'h-[min(88dvh,760px)]' : ''}>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}
          leading={<BrandMark name={title} color={isCash ? 'var(--color-brand-sunken)' : accountColor(method)} size={40} alert={!!gap}
            logo={isCash ? null : bankLogoForName(accountTitle(method))} icon={isCash ? createElement(paymentTypeIcon('cash'), { className: 'size-5', 'aria-hidden': true }) : undefined} />}>
          <V3SheetHeader.Title>{title}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{[isPrepaid ? t.typePrepaid : null, accountIdentifier(method), cur].filter(Boolean).join(' · ')}</V3SheetHeader.Subtitle>
          <V3SheetHeader.Extra>
            <IconButton aria-label={tAll.common.moreActions} aria-haspopup="menu" aria-expanded={menuAnchor !== null} variant="tinted" onClick={(e) => setMenuAnchor(e.currentTarget.getBoundingClientRect())}>
              <MoreVertical size={18} />
            </IconButton>
          </V3SheetHeader.Extra>
        </V3SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y pb-5 pt-2">
          <div className="px-5">
            <InlineBalanceEdit current={balance ? balance.balance : null} currency={cur} masked={masked} draft={draft} onDraftChange={setDraft}
              reported={reported} onSave={save} allowNegative={allowsNegativeBalance(method.type)}
              hint={isCash ? t.cashEstimateHint : undefined}
              badge={balance && balance.balance < 0 ? <Badge variant="warning">{t.overdrawn}</Badge> : isCash ? <Badge variant="muted">{t.cashEstimate}</Badge> : null} />
            {!editing && balance && balance.held > 0 ? (
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

          {!editing && !isCash && gap ? (
            <div className="mx-5 flex items-center gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--color-brand-amber)_35%,transparent)] bg-[var(--color-brand-elevated)] py-2.5 pe-2 ps-3.5">
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-[var(--color-brand-amber)]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.8125rem] font-semibold text-[var(--color-brand-text-primary)]">{(gap > 0 ? t.extraTitle : t.missingTitle)(fmt(Math.abs(gap)))}</span>
                <span className="block text-xs text-[var(--color-brand-text-secondary)]">{gap > 0 ? t.extraSub : t.missingSub}</span>
              </span>
              {onFix ? <Button variant="secondary" size="touch" onClick={onFix}>{gap > 0 ? t.whereDidItComeFrom : t.whereDidItGo}</Button> : null}
            </div>
          ) : !editing && live.data ? (
            <div className={cn('mx-5 space-y-2 rounded-2xl border bg-[var(--color-brand-elevated)] p-3.5', smsMatches ? 'border-[var(--color-brand-border)]' : 'border-[color-mix(in_oklab,var(--color-brand-amber)_35%,transparent)]')}>
              <div className="flex items-center gap-3">
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', smsMatches ? 'bg-[var(--color-brand-green)]' : 'bg-[var(--color-brand-amber)]')} />
                <span className="min-w-0 flex-1">
                  <span dir="auto" className="block text-[0.8125rem] font-semibold text-[var(--color-brand-text-primary)]">{smsMatches ? t.smsMatch : t.smsShows(fmt(live.data.balance))}</span>
                  <span dir="auto" className="block text-xs text-[var(--color-brand-text-secondary)]">{uc.from(clock(live.data.reportedAt, locale))}</span>
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
          ) : !editing && live.blocked ? (
            <p dir="auto" role="status" className="mx-5 rounded-2xl bg-[var(--color-brand-elevated)] p-3.5 text-xs text-[var(--color-brand-text-secondary)]">{uc.blocked}</p>
          ) : null}

          {!editing && (parentKind || isPrepaid) ? (
            <section className="px-5">
              <h3 className="mb-2 flex items-center gap-1.5 text-[0.8125rem] font-bold text-[var(--color-brand-text-secondary)]">
                {isPrepaid ? t.typePrepaid : t.cardsHeading}
                {parentKind ? <Badge variant="muted" size="xs" className="font-mono-numbers">{cards.length}</Badge> : null}
              </h3>
              <div dir="ltr" className="native-scroll -mx-5 flex items-center gap-2 overflow-x-auto px-5 py-1">
                {isPrepaid ? <CardFaceChip method={method} /> : cards.map((c) => (
                  <button key={c.id} type="button" data-raw-button-ok="a card face is its own tap target" onClick={() => onOpenCard(c)}
                    aria-label={`${accountTitle(method)} ${c.last4 ?? ''}`.trim()} className="flex min-h-14 shrink-0 items-center rounded-[9px] transition-transform duration-150 active:scale-[0.97] motion-reduce:transition-none">
                    <CardFaceChip method={c} parent={method} />
                  </button>
                ))}
                {parentKind ? (
                  <button type="button" data-raw-button-ok="the dashed add-card slot of the cards row" onClick={onAddCard} aria-label={t.addACard}
                    className="flex min-h-14 shrink-0 items-center gap-2.5 text-start">
                    <span className="flex h-14 w-[88px] items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-[var(--color-brand-border-strong)] text-[var(--color-brand-primary-ink)]">
                      <Plus className="size-4" aria-hidden />
                    </span>
                    {cards.length === 0 ? <span className="text-[0.78125rem] font-semibold text-[var(--color-brand-primary-ink)]">{t.addACard}</span> : null}
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          {!editing ? (
            <div className={cn('grid gap-2 px-5', tiles.length === 3 ? 'grid-cols-3' : tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
              {tiles.map((x) => (
                <Button key={x.key} variant="secondary" size="cta-block" className="h-16 flex-col gap-1 text-xs" onClick={x.onClick} disabled={x.disabled}>{x.icon}{x.label}</Button>
              ))}
            </div>
          ) : null}

          {!editing && month?.flowsIn !== undefined ? (
            <div className="mx-5 grid grid-cols-2 divide-x divide-[var(--color-brand-border)] rounded-2xl border border-[var(--color-brand-border)] rtl:divide-x-reverse">
              <div className="px-3.5 py-3">
                <p className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{t.inThisMonth}</p>
                <p dir="ltr" className="text-start font-mono-numbers text-base font-semibold tabular-nums text-[var(--color-brand-green)]">{masked ? MASK : month.flowsIn ? `+${moneyFlex(month.flowsIn, cur)}` : '0'}</p>
              </div>
              <div className="px-3.5 py-3">
                <p className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{t.outThisMonth}</p>
                <p dir="ltr" className="text-start font-mono-numbers text-base font-semibold tabular-nums text-[var(--color-brand-text-primary)]">{masked ? MASK : month.flowsOut ? `−${moneyFlex(month.flowsOut, cur)}` : '0'}</p>
              </div>
            </div>
          ) : null}

          {!editing ? (
            <SheetActivity title={t.recent} rows={activity} masked={masked} method={method} emptyLine={t.emptyAccountActivity} onLeave={onClose} />
          ) : null}
        </div>
      </div>
      <CardActionMenu anchor={menuAnchor} items={manageItems} onClose={() => setMenuAnchor(null)} zClassName="z-[110]" />
    </ModalShell>
  )
}
