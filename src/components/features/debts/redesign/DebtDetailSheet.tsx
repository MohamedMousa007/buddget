'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { ArrowDownLeft, ArrowUpRight, Calendar, Check, ChevronUp, CircleCheck, MoreVertical, Pencil, Plus, ReceiptText, Trash2, Zap } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SwipeToDelete, type SwipeSide } from '@/components/expenses/SwipeToDelete'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { FLOW_BAND_BG, BAND_MIX } from '@/components/features/hero/HeroBand'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconButton } from '@/components/ui/IconButton'
import { CardActionMenu, type CardMenuItem } from '@/components/ui/CardActionMenu'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { useLinkedDelete } from '@/hooks/useLinkedDelete'
import { findProviderBrand } from '@/lib/constants/installmentProviders'
import { debtFamily } from '@/lib/debts/debtFamily'
import { isOwedToUser } from '@/lib/debts/debtDirection'
import { addByFrequency, installmentPaymentsCompleted } from '@/lib/debts/installmentSchedule'
import { countedDebtPayments, countedDebts } from '@/lib/spending/exclusion'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { calculateDebtRemaining, totalPaidTowardDebt } from '@/lib/utils/calculations'
import { formatFlex, formatWhole } from '@/lib/utils/formatters'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { useDebtsV9Copy } from '@/lib/i18n/debtsV9Copy'
import { ProviderBadge } from './ProviderBadge'

const PILL = 'inline-flex min-h-7 items-center gap-1 rounded-full bg-[color-mix(in_oklab,var(--flow-band-fg)_14%,transparent)] px-3 text-[0.78125rem] font-semibold [&_svg]:size-3.5'

function Fact({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 px-4">
      <span className="w-[112px] shrink-0 text-[0.84375rem] text-[var(--color-brand-text-secondary)]">{k}</span>
      <span dir="auto" className="flex min-w-0 flex-1 items-center justify-end gap-2 text-end text-[0.9375rem] font-medium text-[var(--color-brand-text-primary)]">{v}</span>
    </div>
  )
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h3 className={microClassName}>{title}</h3>
        {right ? <span className="font-mono-numbers text-[0.6875rem] text-[var(--color-brand-text-muted)]">{right}</span> : null}
      </div>
      {children}
    </section>
  )
}

/**
 * One borrow or installment (round 9: a single item is a sheet): tinted hero, one CTA, then payments and the facts. Installments add the
 * next payment, n of N and the schedule. The ⋮ is the shared CardActionMenu: Edit, Mark settled (borrow) or Pay off early (installment), Delete.
 * `readOnly` is a cleared debt: no CTA and no menu.
 */
export function DebtDetailSheet({ debtId, onClose, onPay, onEdit, readOnly = false }: {
  debtId: string | null
  onClose: () => void
  /** Opens Add payment; `full` prefills what is left (Pay off early). */
  onPay: (id: string, full?: boolean) => void
  onEdit: (id: string) => void
  readOnly?: boolean
}) {
  const t = useT()
  const lt = useDebtsSubsLtCopy().debts
  const c = useDebtsV9Copy()
  const { locale } = useLocale()
  const confirm = useConfirm()
  const { removeDebtPayment } = useLinkedDelete()
  const covered = useSettingsStore((s) => s.activeModal === 'addDebt' || s.activeModal === 'editDebt')
  const { debts, payments, methods, expenses, rates } = useFinanceStore(
    useShallow((s) => ({
      debts: countedDebts(s.debts, s.paymentMethods),
      payments: countedDebtPayments(s.debtPayments, s.debts, s.paymentMethods),
      methods: s.paymentMethods,
      expenses: s.expenses,
      rates: s.exchangeRates,
    })),
  )
  const [menu, setMenu] = useState<DOMRect | null>(null)
  const [all, setAll] = useState(false)
  const [openRow, setOpenRow] = useState<{ id: string; side: SwipeSide } | null>(null)

  const debt = debtId ? debts.find((d) => d.id === debtId) : undefined
  const pays = useMemo(
    () => (debt ? payments.filter((p) => p.debtId === debt.id).sort((a, b) => b.date.localeCompare(a.date)) : []),
    [debt, payments],
  )
  if (!debt) return null

  const install = debtFamily(debt) === 'installment'
  const owed = isOwedToUser(debt)
  const left = calculateDebtRemaining(debt, pays, { expenses, exchangeRates: rates, allDebts: debts })
  const paid = totalPaidTowardDebt(debt.id, pays)
  const unit = debt.isGold ? 'g' : debt.currency
  const day = (iso: string) => formatLocalized(parseISO(iso.slice(0, 10)), 'MMM d', locale)
  const longDay = (d: Date) => formatLocalized(d, 'EEE, MMM d', locale)
  const methodName = (id?: string) => (id ? methods.find((m) => m.id === id)?.name : undefined)
  const who = debt.personName || debt.person || debt.name

  const brand = install ? findProviderBrand((debt.installmentProviderName ?? '').toLowerCase().replace(/\s+/g, '') || debt.installmentProvider) : undefined
  const provider = brand?.name ?? debt.installmentProviderName ?? t.debts.installmentFallback
  const tone = owed ? 'var(--color-brand-green)' : 'var(--color-brand-amber)'
  const lead = install
    ? <ProviderBadge slug={brand?.slug} name={provider} size={36} />
    : <span aria-hidden className="flex size-9 items-center justify-center rounded-full text-[0.9375rem] font-bold" style={{ background: `color-mix(in oklab, ${tone} 18%, transparent)`, color: tone }}>{who.trim().charAt(0).toUpperCase() || '?'}</span>

  const count = debt.installmentCount ?? 0
  const per = debt.installmentAmount ?? debt.goal?.calculatedAmount ?? 0
  const done = install ? installmentPaymentsCompleted(debt, pays) : 0
  const schedule = install && debt.startDate && count > 0
    ? Array.from({ length: count }, (_, i) => addByFrequency(parseISO(debt.startDate!.slice(0, 10)), debt.installmentFrequency ?? 'monthly', i))
    : []
  const nextDate = schedule[done]
  const pct = install ? (count > 0 ? (done / count) * 100 : 0) : debt.startingBalance > 0 ? (paid / debt.startingBalance) * 100 : 0
  const paidWith = methodName(debt.defaultPaymentMethodId || debt.linkedPaymentMethodId) ?? methodName(pays[0]?.paymentMethodId)

  const items: CardMenuItem[] = [
    { label: c.menu.edit, icon: <Pencil className="size-4 shrink-0" />, onSelect: () => onEdit(debt.id) },
    install
      ? { label: c.menu.early, hint: c.menu.earlyHint(formatWhole(left)), icon: <Zap className="size-4 shrink-0" />, onSelect: () => onPay(debt.id, true) }
      : {
          label: c.menu.settle,
          hint: owed ? c.menu.settleOwed : c.menu.settleOwe,
          icon: <CircleCheck className="size-4 shrink-0" />,
          onSelect: () => void confirm({ title: c.menu.settleTitle(debt.name || who), body: c.menu.settleBody(`${formatWhole(left)} ${unit}`, owed), confirmLabel: c.menu.settle })
            .then((ok) => { if (ok) { useFinanceStore.getState().clearDebt(debt.id); onClose() } }),
        },
    {
      label: c.menu.delete,
      destructive: true,
      icon: <Trash2 className="size-4 shrink-0" />,
      onSelect: () => void confirm({ title: lt.deleteTitle(debt.name || who), body: lt.deleteBody, confirmLabel: t.common.delete, destructive: true })
        .then((ok) => { if (ok) { useFinanceStore.getState().deleteDebt(debt.id); onClose() } }),
    },
  ]

  const hero = (
    <section className="overflow-hidden rounded-3xl px-[18px] pb-4 pt-4 text-[var(--flow-band-fg)]" style={{ background: FLOW_BAND_BG }}>
      <div className="flex items-center gap-3">
        <span className="rounded-[13px] bg-[var(--flow-band-fg)] p-0.5">{lead}</span>
        <span dir="auto" className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold opacity-85">{install ? provider : debt.relationship || debt.description || who}</span>
      </div>
      <p className="mt-4 text-xs font-semibold opacity-80">{owed ? c.detail.stillToGet : c.detail.leftToPay}</p>
      <p className="flex items-baseline gap-1.5">
        <span className="font-mono-numbers text-[32px] font-semibold leading-[1.05] tracking-[-0.04em]">{formatFlex(left)}</span>
        <span className="text-[0.8125rem] font-semibold">{unit}</span>
        {install && count > 0 ? <span className="ms-auto font-mono-numbers text-[0.8125rem] font-semibold">{c.detail.ofPaid(done, count)}</span> : null}
      </p>
      {install && count > 0 ? (
        <div aria-hidden className="mt-3 flex h-1.5 gap-[3px]">
          {schedule.map((_, i) => (
            <span key={i} className="h-full flex-1 rounded-full" style={{ background: i < done ? 'var(--flow-band-fg)' : BAND_MIX, boxShadow: i === done ? 'inset 0 0 0 1.5px var(--flow-band-fg)' : undefined }} />
          ))}
        </div>
      ) : (
        <div aria-hidden className="mt-3 h-1.5 rounded-full" style={{ background: BAND_MIX }}>
          <div className="h-full rounded-full bg-[var(--flow-band-fg)]" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </div>
      )}
      {install ? (
        schedule.length ? <p className="mt-2 text-xs opacity-80">{c.detail.lastPayment(formatLocalized(schedule[schedule.length - 1], 'MMM d, yyyy', locale), formatWhole(debt.startingBalance))}</p> : null
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={PILL}>{owed ? <ArrowDownLeft aria-hidden /> : <ArrowUpRight aria-hidden />}{owed ? c.detail.youLent : c.detail.youBorrowed}</span>
          <span className={PILL}>{debt.goal ? (owed ? c.list.expected : c.list.due)(formatLocalized(parseISO(debt.goal.targetDate.slice(0, 10)), 'MMM d', locale)) : c.list.noDue}</span>
          {debt.goal ? <span className={PILL}>{c.detail.aMonth(formatWhole(debt.goal.calculatedAmount))}</span> : null}
        </div>
      )}
    </section>
  )

  const nextCard = install && nextDate && !readOnly ? (
    <Card className="mt-3 p-4">
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className={`block ${microClassName}`}>{c.detail.nextPayment}</span>
          <span className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono-numbers text-[1.5rem] font-semibold tracking-[-0.03em] text-[var(--color-brand-text-primary)]">{formatWhole(per)}</span>
            <span className="text-[0.8125rem] text-[var(--color-brand-text-muted)]">{unit}</span>
          </span>
          <span className="mt-0.5 block text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{c.detail.inDays(longDay(nextDate), differenceInCalendarDays(nextDate, new Date()))}</span>
        </span>
        <span className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-[var(--color-brand-elevated)] px-2.5 text-[0.75rem] font-semibold text-[var(--color-brand-text-secondary)]">
          <Calendar aria-hidden className="size-3.5" />
          {c.detail.paymentN(done + 1)}
        </span>
      </div>
      {paidWith ? <p dir="auto" className="mt-3 truncate border-t border-[var(--color-brand-border)] pt-3 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{c.detail.chargedTo(paidWith)}</p> : null}
    </Card>
  ) : null

  const shown = schedule.map((d, i) => ({ d, i })).filter(({ i }) => all || i >= done - 1)
  const scheduleBlock = install && schedule.length ? (
    <Section title={c.detail.schedule} right={c.detail.ofPaid(done, count)}>
      <Card padding="none" divide className="overflow-hidden">
        {!all && done > 1 ? (
          <Button variant="ghost" size="touch" onClick={() => setAll(true)} className="w-full rounded-none text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">
            <ChevronUp aria-hidden />{c.detail.showEarlier(done - 1)}
          </Button>
        ) : null}
        {shown.map(({ d, i }) => {
          const state = i < done ? 'paid' : i === done ? 'next' : 'up'
          return (
            <div key={i} className={`flex min-h-[52px] items-center gap-3 px-4 ${state === 'next' ? 'bg-[var(--color-brand-primary-soft)]' : ''}`}>
              {state === 'paid' ? (
                <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]"><Check className="size-3.5" /></span>
              ) : state === 'next' ? (
                <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-brand-primary)]"><span className="size-2 rounded-full bg-[var(--color-brand-primary)]" /></span>
              ) : (
                <span aria-hidden className="size-6 shrink-0 rounded-full border-2 border-dashed border-[var(--color-brand-border-strong)]" />
              )}
              <span className="min-w-0 flex-1">
                <span className={`block text-[0.875rem] font-semibold ${state === 'up' ? 'text-[var(--color-brand-text-secondary)]' : 'text-[var(--color-brand-text-primary)]'}`}>{c.detail.paymentN(i + 1)}</span>
                <span className="block text-xs text-[var(--color-brand-text-muted)]">{formatLocalized(d, 'MMM d, yyyy', locale)}</span>
              </span>
              <span className="text-end">
                <span className={`block font-mono-numbers text-[0.9375rem] font-medium ${state === 'up' ? 'text-[var(--color-brand-text-secondary)]' : 'text-[var(--color-brand-text-primary)]'}`}>{formatWhole(per)}</span>
                <span className={`text-xs ${state === 'paid' ? 'font-semibold text-[var(--color-brand-green)]' : state === 'next' ? 'font-semibold text-[var(--color-brand-primary-ink)]' : 'text-[var(--color-brand-text-muted)]'}`}>
                  {state === 'paid' ? c.detail.paid : state === 'next' ? c.detail.next : c.detail.upcoming}
                </span>
              </span>
            </div>
          )
        })}
        {all ? (
          <Button variant="ghost" size="touch" onClick={() => setAll(false)} className="w-full rounded-none text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)]">
            <ChevronUp aria-hidden />{c.detail.showLess}
          </Button>
        ) : null}
      </Card>
    </Section>
  ) : null

  const logTitle = owed ? c.detail.repayments : c.detail.payments
  const log = (
    <Section title={logTitle} right={pays.length && !readOnly ? c.detail.swipeHint : undefined}>
      {pays.length ? (
        <Card padding="none" divide className="overflow-hidden">
          {pays.map((p) => {
            const row = (
              <TransactionRow
                icon={owed ? <ArrowDownLeft className="size-5" /> : <ReceiptText className="size-5" />}
                iconBg={`color-mix(in oklab, ${owed ? 'var(--color-brand-green)' : 'var(--color-brand-primary)'} 14%, transparent)`}
                iconFg={owed ? 'var(--color-brand-green)' : 'var(--color-brand-primary)'}
                title={owed ? c.detail.paidBackTitle(who) : `${install ? provider : debt.name || who} · ${formatLocalized(parseISO(p.date.slice(0, 10)), 'MMMM', locale)}`}
                subtitle={[day(p.date), methodName(p.paymentMethodId)].filter(Boolean).join(' · ')}
                amount={`${owed ? '+' : '−'}${formatFlex(p.amountPaid)}`}
                amountColor={owed ? 'var(--color-brand-green)' : undefined}
              />
            )
            return readOnly ? <div key={p.id}>{row}</div> : (
              <SwipeToDelete
                key={p.id}
                openSide={openRow?.id === p.id ? openRow.side : null}
                onOpenChange={(side) => setOpenRow(side ? { id: p.id, side } : null)}
                onDelete={() => { setOpenRow(null); void removeDebtPayment(p.id) }}
                deleteLabel={t.common.delete}
              >
                {row}
              </SwipeToDelete>
            )
          })}
        </Card>
      ) : (
        <EmptyState
          variant="card"
          size="section"
          icon={<ReceiptText strokeWidth={1.8} />}
          iconTone="neutral"
          title={owed ? c.detail.noRepayments : c.detail.noPayments}
          description={install ? c.detail.noInstallPaymentsBody : owed ? c.detail.noRepaymentsBody(who) : c.detail.noPaymentsBody}
        />
      )}
    </Section>
  )

  const started = (debt.startDate || debt.createdAt).slice(0, 10)
  const facts = install ? (
    <Section title={c.detail.plan}>
      <Card padding="none" divide className="overflow-hidden">
        <Fact k={c.detail.provider} v={<><ProviderBadge slug={brand?.slug} name={provider} size={24} /><span className="truncate">{provider}</span></>} />
        {debt.name ? <Fact k={c.detail.purchase} v={<span className="truncate">{debt.name}</span>} /> : null}
        <Fact k={c.detail.eachMonth} v={<span className="font-mono-numbers">{formatWhole(per)}</span>} />
        <Fact k={c.detail.totalCost} v={<b className="font-mono-numbers font-semibold">{formatWhole(debt.startingBalance)}</b>} />
        {paidWith ? <Fact k={c.detail.paidWith} v={<span className="truncate">{paidWith}</span>} /> : null}
        <Fact k={c.detail.started} v={formatLocalized(parseISO(started), 'MMM d, yyyy', locale)} />
      </Card>
    </Section>
  ) : (
    <Section title={c.detail.details}>
      <Card padding="none" divide className="overflow-hidden">
        <Fact k={c.detail.person} v={<span className="truncate">{who}</span>} />
        <Fact k={c.detail.direction} v={owed ? c.detail.theyOweYou : c.detail.youOweThem} />
        <Fact k={owed ? c.detail.lent : c.detail.borrowed} v={<span className="font-mono-numbers">{formatFlex(debt.startingBalance)}</span>} />
        <Fact k={owed ? c.detail.paidBack : c.detail.paidSoFar} v={<span className="font-mono-numbers">{formatFlex(paid)}</span>} />
        <Fact k={c.detail.left} v={<b className="font-mono-numbers font-semibold">{formatFlex(left)}</b>} />
        {count > 0 ? <Fact k={c.detail.paymentsRow} v={<span className="font-mono-numbers">{c.detail.ofN(pays.length, count)}</span>} /> : null}
        {debt.goal ? <Fact k={c.detail.eachMonth} v={<span className="font-mono-numbers">{formatWhole(debt.goal.calculatedAmount)}</span>} /> : null}
        <Fact k={c.detail.dueDate} v={debt.goal ? formatLocalized(parseISO(debt.goal.targetDate.slice(0, 10)), 'EEE, MMM d, yyyy', locale) : <span className="text-[var(--color-brand-text-muted)]">{c.detail.noneSet}</span>} />
        <Fact k={c.detail.started} v={formatLocalized(parseISO(started), 'MMM d, yyyy', locale)} />
        {methodName(debt.principalPaymentMethodId) ? <Fact k={owed ? c.detail.paidFrom : c.detail.receivedIn} v={<span className="truncate">{methodName(debt.principalPaymentMethodId)}</span>} /> : null}
      </Card>
    </Section>
  )

  const title = debt.name || who
  const ctaLabel = owed ? c.detail.addRepayment : install && per > 0 ? c.detail.pay(formatWhole(per)) : c.detail.addPayment

  return (
    <ModalShell open onBackdropClick={onClose} scrollChild behind={covered}>
      <div className="flex min-h-0 flex-1 flex-col">
        <V3SheetHeader
          onClose={onClose}
          actions={readOnly ? undefined : (
            <IconButton aria-label={c.menu.more} aria-haspopup="menu" aria-expanded={menu !== null} variant="sheetAction" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>
              <MoreVertical size={16} />
            </IconButton>
          )}
        >
          <V3SheetHeader.Title size="compact">{title}</V3SheetHeader.Title>
          <V3SheetHeader.Subtitle>{install ? c.detail.installSub(provider) : owed ? c.detail.owedSub : c.detail.borrowSub}</V3SheetHeader.Subtitle>
        </V3SheetHeader>
        <div className="native-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(24px+env(safe-area-inset-bottom))]">
          {hero}
          {readOnly ? null : (
            <Button size="cta-block" onClick={() => onPay(debt.id)} className="mt-3">
              <Plus aria-hidden />
              {ctaLabel}
            </Button>
          )}
          {nextCard}
          {scheduleBlock}
          {log}
          {facts}
        </div>
      </div>
      <CardActionMenu anchor={menu} items={items} onClose={() => setMenu(null)} zClassName="z-[110]" title={title} />
    </ModalShell>
  )
}
