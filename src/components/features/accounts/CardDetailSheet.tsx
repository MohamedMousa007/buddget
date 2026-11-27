'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { CardFace, FACE_W } from '@/components/features/payments/CardFace'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PickerRow } from '@/components/ui/PickerRow'
import { Switch } from '@/components/ui/switch'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { IconButton } from '@/components/ui/IconButton'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { useActionToast } from '@/components/ui/ActionToast'
import { removeMethodWithUndo } from '@/lib/accounts/methodUndo'
import { followsAccountCurrency } from '@/lib/accounts/actions'
import { availableCredit, cardDetails, sheetActivity } from '@/lib/accounts/cardDetails'
import { cardLook } from '@/lib/payment/cardThemes'
import { allowsLast4 } from '@/lib/payment/paymentMethodDefaults'
import { MASK } from '@/lib/privacy/mask'
import type { PaymentMethod } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { useAccountsLtCopy } from '@/lib/i18n/accountsLtCopy'
import { useLightTouchCopy } from '@/lib/i18n/lightTouchCopy'
import { accountDisplayName, accountTitle, cardKindLabel, moneyFlex } from './accountDisplay'
import { AccountNameValue } from './AccountPicker'
import { SheetActivity } from './SheetActivity'

interface CardDetailSheetProps {
  open: boolean
  onClose: () => void
  card: PaymentMethod
  /** The account the card spends from, when it hangs under one. */
  parent?: PaymentMethod
  masked: boolean
  /** Opens the card form in edit mode. */
  onEdit: () => void
  /** Opens the parent account's sheet; omit when that sheet is already under this one. */
  onOpenParent?: () => void
  /** Another sheet is stacked over this one. */
  behind?: boolean
  /** Leaving for another modal (an expense): closes every sheet under this one too. Defaults to `onClose`. */
  onLeave?: () => void
  /** Stacked over the account sheet: `z-[110]`. */
  zIndexClassName?: string
}

/** One card on its own (Light touch): its 320px face, what it owes, the account it uses, the default switch, what was spent with it. */
export function CardDetailSheet({ open, onClose, card, parent, masked, onEdit, onOpenParent, behind, zIndexClassName, onLeave }: CardDetailSheetProps) {
  const all = useT()
  const t = all.accountsPage
  const lt = useAccountsLtCopy()
  const ordinal = useLightTouchCopy().dayOfMonth.ordinal
  const router = useRouter()
  const confirm = useConfirm()
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)
  const toast = useActionToast()
  const debts = useFinanceStore((s) => s.debts)
  const expenses = useFinanceStore((s) => s.expenses)
  const payments = useFinanceStore((s) => s.debtPayments)
  const rates = useFinanceStore((s) => s.exchangeRates)
  const methods = useFinanceStore((s) => s.paymentMethods)
  const [menu, setMenu] = useState<DOMRect | null>(null)

  const details = useMemo(() => cardDetails(card, debts, expenses, payments, rates), [card, debts, expenses, payments, rates])
  const activity = useMemo(() => sheetActivity(card, parent?.id ?? card.id, expenses, methods), [card, parent, expenses, methods])
  const kind = cardKindLabel(card.type, t)
  const bank = accountTitle(parent ?? card)
  // The card's own Name, else the account's Name (or provider) with the kind, as the card rows title it.
  const name = card.label?.trim() || `${parent ? accountDisplayName(parent) : bank} ${kind}`
  const look = cardLook(card)
  const money = (n: number, cur: string) => (masked ? MASK : moneyFlex(n, cur))

  const items = [
    { label: all.paymentMethods.edit, icon: <Pencil size={17} />, onSelect: onEdit },
    {
      label: all.paymentMethods.delete, icon: <Trash2 size={17} />, destructive: true,
      onSelect: async () => {
        if (!(await confirm({ title: t.deleteCard, body: all.paymentMethods.deleteCardBody, confirmLabel: t.deleteCard, cancelLabel: t.keepCard, destructive: true }))) return
        const undo = removeMethodWithUndo(card.id, 'delete')
        if (!undo) return
        onClose()
        toast(lt.removed.cardDeleted(name), { undo, undoLabel: all.common.undo })
      },
    },
  ]

  let detail = null
  if (details.kind === 'credit') {
    const owed = details.outstanding ?? 0
    const available = availableCredit(details.limit, details.outstanding)
    const pct = details.limit ? Math.max(0, Math.min(100, Math.round((owed / details.limit) * 100))) : null
    // "<b>21,580</b> available of 30,000 · due on the 15th": the available figure leads in bold, as in the mockup.
    const SLOT = '\u0000'
    const [availBefore, availAfter] = available !== null && details.limit !== null
      ? lt.card.availableOf(SLOT, money(details.limit, details.currency)).split(SLOT)
      : [null, null]
    const due = details.dueDay !== null ? lt.card.dueOn(ordinal(details.dueDay)) : null
    const facts = availBefore !== null && available !== null ? (
      <>{availBefore}<b className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">{money(available, details.currency)}</b>{availAfter}{due ? ` \u00b7 ${due}` : ''}</>
    ) : due
    detail = (
      <Card padding="none" className="mx-4 rounded-2xl p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[0.8125rem] font-medium text-[var(--color-brand-text-secondary)]">{owed > 0 ? t.owed : t.nothingOwed}</span>
          {owed > 0 ? (
            <span dir="ltr" className="font-mono-numbers text-2xl font-semibold tracking-[-0.03em] text-[var(--color-brand-red-text)]">
              {money(owed, details.currency)} <span className="text-xs font-medium text-[var(--color-brand-text-muted)]">{details.currency}</span>
            </span>
          ) : null}
        </div>
        {pct !== null ? (
          <div role="img" aria-label={t.usedPct(pct)} className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-brand-sunken)]">
            <span className="block h-full rounded-full bg-[var(--color-brand-red)]" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
        {facts ? <p dir="auto" className="mt-2 text-xs text-[var(--color-brand-text-secondary)]">{facts}</p> : null}
      </Card>
    )
  } else if (card.type === 'bnpl') {
    detail = (
      <div className="mx-4 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
        {details.kind === 'bnpl' ? <p className="mb-1 font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">{details.paid}/{details.count}</p> : null}
        <Button variant="link" className="h-11 px-0" onClick={() => { (onLeave ?? onClose)(); router.push('/debts') }}>{t.planInDebts}<ChevronRight aria-hidden className="rtl:rotate-180" /></Button>
      </div>
    )
  }

  const uses = parent && card.type !== 'credit_card' ? (
    <PickerRow label={lt.addCard.uses} onClick={onOpenParent} chevron={!!onOpenParent}
      value={<AccountNameValue method={parent} />} />
  ) : null

  const scale = 320 / FACE_W
  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild behind={behind} zIndexClassName={zIndexClassName}>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}
          actions={
            <IconButton aria-label={all.common.moreActions} aria-haspopup="menu" aria-expanded={menu !== null} variant="sheetAction" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>
              <MoreVertical size={16} />
            </IconButton>
          }>
          <V3SheetHeader.Title>{name}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{[kind, card.last4 && allowsLast4(card.type) ? `\u2022\u2022${card.last4}` : null, String(card.currency)].filter(Boolean).join(' \u00b7 ')}</V3SheetHeader.Subtitle>
        </V3SheetHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y pb-5 pt-1">
          <div className="flex justify-center px-4 pb-2" aria-hidden>
            <CardFace theme={look.theme} style={look.style} bank={bank} kind={kind} last4={allowsLast4(card.type) ? card.last4 : undefined}
              currency={String(card.currency)} scale={scale} />
          </div>
          {parent && followsAccountCurrency(card) && card.currency !== parent.currency ? (
            <div className="flex justify-center"><Badge variant="warning" size="sm">{lt.account.differentCurrency}</Badge></div>
          ) : null}
          {detail}
          <Card padding="none" divide className="mx-4 overflow-hidden rounded-2xl">
            {uses}
            <div className="flex min-h-[52px] w-full items-center gap-3 px-4">
              <span className="min-w-0 flex-1 text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">{t.defaultForNew}</span>
              <Switch size="touch" aria-label={t.defaultForNew} checked={card.isDefault}
                onCheckedChange={(on) => updatePaymentMethod(card.id, { isDefault: on })} />
            </div>
          </Card>
          <SheetActivity title={t.spentWith(name)} rows={activity} masked={masked} method={card} emptyLine={t.emptyCardActivity} onLeave={onLeave ?? onClose} />
        </div>
      </div>
      <CardActionMenu anchor={menu} items={items} onClose={() => setMenu(null)} zClassName={zIndexClassName ? 'z-[120]' : 'z-[110]'} title={name} />
    </ModalShell>
  )
}
