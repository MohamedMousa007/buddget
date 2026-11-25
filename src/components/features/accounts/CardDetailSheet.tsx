'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, MoreVertical, Pencil, ShieldCheck, Star, Trash2 } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { CardFace, FACE_W } from '@/components/features/payments/CardFace'
import { Button } from '@/components/ui/button'
import { CardActionMenu } from '@/components/ui/CardActionMenu'
import { IconButton } from '@/components/ui/IconButton'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { availableCredit, cardDetails, sheetActivity } from '@/lib/accounts/cardDetails'
import { cardLook } from '@/lib/payment/cardThemes'
import { allowsLast4 } from '@/lib/payment/paymentMethodDefaults'
import { MASK } from '@/lib/privacy/mask'
import type { PaymentMethod } from '@/lib/store/types'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { accountIdentifier, accountTitle, cardKindLabel, moneyFlex } from './accountDisplay'
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

/** One card on its own: its large face, what it owes or spends from, default, and what was spent with it. */
export function CardDetailSheet({ open, onClose, card, parent, masked, onEdit, onOpenParent, behind, zIndexClassName, onLeave }: CardDetailSheetProps) {
  const all = useT()
  const t = all.accountsPage
  const router = useRouter()
  const confirm = useConfirm()
  const updatePaymentMethod = useFinanceStore((s) => s.updatePaymentMethod)
  const deletePaymentMethod = useFinanceStore((s) => s.deletePaymentMethod)
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
  const name = `${bank} ${kind}`
  const look = cardLook(card)
  const money = (n: number, cur: string) => (masked ? MASK : `${moneyFlex(n, cur)} ${cur}`)

  const items = [
    { label: all.paymentMethods.edit, icon: <Pencil size={17} />, onSelect: onEdit },
    {
      label: all.paymentMethods.delete, icon: <Trash2 size={17} />, destructive: true,
      onSelect: async () => {
        if (!(await confirm({ title: t.deleteCard, body: all.paymentMethods.deleteCardBody, confirmLabel: t.deleteCard, cancelLabel: t.keepCard, destructive: true }))) return
        deletePaymentMethod(card.id)
        onClose()
      },
    },
  ]

  let detail = null
  if (details.kind === 'credit') {
    const owed = details.outstanding ?? 0
    const available = availableCredit(details.limit, details.outstanding)
    const pct = details.limit ? Math.max(0, Math.min(100, Math.round((owed / details.limit) * 100))) : null
    const cell = (label: string, value: string, main = false) => (
      <div className={cn('rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3.5 py-3', main && 'border-[color-mix(in_oklab,var(--color-brand-amber)_35%,transparent)]')}>
        <p className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{label}</p>
        <p dir="ltr" className={cn('mt-0.5 truncate text-start font-mono-numbers text-[1.0625rem] font-semibold tabular-nums', main && owed > 0 ? 'text-[var(--color-brand-amber)]' : 'text-[var(--color-brand-text-primary)]')}>{value}</p>
      </div>
    )
    detail = (
      <div className="space-y-2.5 px-5">
        <div className="grid grid-cols-2 gap-2">
          {cell(t.owed, owed > 0 ? money(owed, details.currency) : t.nothingOwed, true)}
          {cell(t.available, available === null ? '—' : money(available, details.currency))}
          {cell(t.cardLimit, details.limit === null ? '—' : money(details.limit, details.currency))}
          {cell(all.moneyFlows.ccDueDay, details.dueDay === null ? '—' : String(details.dueDay))}
        </div>
        {pct !== null ? (
          <>
            <div role="img" aria-label={t.usedPct(pct)} className="flex h-1.5 overflow-hidden rounded-full bg-[var(--color-brand-sunken)]">
              <span className="h-full rounded-full bg-[var(--color-brand-amber)]" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-[var(--color-brand-text-secondary)]">
              <span>{t.usedPct(pct)}</span><span className="font-mono-numbers">{details.currency}</span>
            </div>
          </>
        ) : null}
        <p className="flex items-center gap-1.5 text-xs text-[var(--color-brand-text-muted)]"><ShieldCheck aria-hidden className="size-3.5 shrink-0" />{t.notFromAccounts}</p>
      </div>
    )
  } else if (card.type === 'bnpl') {
    detail = (
      <div className="mx-5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
        {details.kind === 'bnpl' ? <p className="mb-1 font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">{details.paid}/{details.count}</p> : null}
        <Button variant="link" className="h-11 px-0" onClick={() => { (onLeave ?? onClose)(); router.push('/debts') }}>{t.planInDebts}<ChevronRight aria-hidden className="rtl:rotate-180" /></Button>
      </div>
    )
  } else if (parent) {
    detail = (
      <div className="mx-5 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3.5 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
        <p className="[text-wrap:pretty]">{t.usesBalance([accountTitle(parent), accountIdentifier(parent)].filter(Boolean).join(' '))}</p>
        {onOpenParent ? <Button variant="link" className="h-11 px-0" onClick={onOpenParent}>{accountTitle(parent)}<ChevronRight aria-hidden className="rtl:rotate-180" /></Button> : null}
      </div>
    )
  }

  const scale = Math.min(0.94, 320 / FACE_W)
  return (
    <ModalShell open={open} onBackdropClick={onClose} scrollChild behind={behind} zIndexClassName={zIndexClassName}>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader onClose={onClose}>
          <V3SheetHeader.Title>{name}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{[card.label?.trim(), card.last4 && allowsLast4(card.type) ? `•• ${card.last4}` : null, String(card.currency)].filter(Boolean).join(' · ')}</V3SheetHeader.Subtitle>
          <V3SheetHeader.Extra>
            <IconButton aria-label={all.common.moreActions} aria-haspopup="menu" aria-expanded={menu !== null} variant="tinted" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>
              <MoreVertical size={18} />
            </IconButton>
          </V3SheetHeader.Extra>
        </V3SheetHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y pb-5 pt-2">
          <div className="flex justify-center px-5" aria-hidden>
            <CardFace theme={look.theme} style={look.style} bank={bank} kind={kind} last4={allowsLast4(card.type) ? card.last4 : undefined}
              holder={card.label?.trim() || undefined} currency={String(card.currency)} defaultLabel={card.isDefault ? all.paymentMethods.default : undefined} scale={scale} />
          </div>
          {detail}
          <div className="px-5">
            {card.isDefault ? (
              <p className="flex min-h-12 items-center gap-2.5 rounded-2xl bg-[var(--color-brand-primary-soft)] px-3.5 text-sm font-semibold text-[var(--color-brand-primary-ink)]">
                <Star aria-hidden className="size-4 shrink-0 fill-current" />{t.defaultForNew}
              </p>
            ) : (
              <Button variant="outline" size="cta-block" onClick={() => updatePaymentMethod(card.id, { isDefault: true })}><Star aria-hidden />{all.paymentMethods.setDefault}</Button>
            )}
          </div>
          <SheetActivity title={t.spentWith(name)} rows={activity} masked={masked} method={card} emptyLine={t.emptyCardActivity} onLeave={onLeave ?? onClose} />
        </div>
      </div>
      <CardActionMenu anchor={menu} items={items} onClose={() => setMenu(null)} zClassName={zIndexClassName ? 'z-[120]' : 'z-[110]'} title={name} />
    </ModalShell>
  )
}
