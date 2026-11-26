'use client'

import { addYears, format, parseISO, startOfDay } from 'date-fns'
import { Calendar, Trash2, Unlink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { AmountHero } from '@/components/ui/AmountHero'
import { useActionToast } from '@/components/ui/ActionToast'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { IconButton } from '@/components/ui/IconButton'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { HEADER_PILL, Pill } from '@/components/ui/PillButton'
import { PickerRow } from '@/components/ui/PickerRow'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { SettingsSwitchRow } from '@/components/features/settings/SettingsSwitchRow'
import { MethodPickerRow } from '@/components/features/debts/lt/MethodPickerRow'
import { SheetGroup } from '@/components/features/debts/lt/SheetParts'
import { useSubscriptionDates } from '@/hooks/useSubscriptionDates'
import { useTypedAmount } from '@/hooks/useTypedAmount'
import { useT } from '@/lib/i18n'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { Currency, SubscriptionBillingCycle } from '@/lib/store/types'
import { EXPENSE_ENTRY_CATEGORIES } from '@/lib/constants/finance'
import { foreignSymbol } from '@/lib/constants/currencyMeta'
import { chargeAmount, markPaidTarget, scheduledDates } from '@/lib/subscriptions/subscriptionForecast'
import { priceHistoryNewestFirst } from '@/lib/subscriptions/subscriptionPricing'
import { useSubsPageLtCopy } from '@/lib/i18n/subsPageLtCopy'
import { buildRow } from '@/lib/subscriptions/subscriptionRows'
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge'
import { convertCurrency, tryConvertCurrency } from '@/lib/utils/currency'
import { formatFixed2 } from '@/lib/utils/formatters'
import { localTodayISO } from '@/lib/utils/localDate'
import { BrandTile } from './BrandTile'
import { SheetFrame } from './SheetFrame'

const CYCLES: SubscriptionBillingCycle[] = ['weekly', 'monthly', 'quarterly', 'semiannual', 'yearly']

/**
 * One subscription (Light touch `sub`): the next charge in the header, logo and name, the price with its currency and
 * what it is in the base currency, the derived status, then Paid with · Category · Repeats · Remind me and the last
 * charges. Buddgy sets the status from the bank messages; there is no pause.
 */
export function SubscriptionDetailSheet({
  subId,
  onClose,
  onEdit,
  onCancel,
}: {
  subId: string | null
  onClose: () => void
  onEdit: (id: string) => void
  onCancel: (id: string) => void
}) {
  const t = useT()
  const ui = t.subscriptions.ui
  const c = useDebtsSubsLtCopy().subs
  const pageCopy = useSubsPageLtCopy()
  const confirm = useConfirm()
  const toast = useActionToast()
  const { shortDate, monthYear } = useSubscriptionDates()
  const s = useFinanceStore(
    useShallow((st) => ({
      sub: st.subscriptions.find((x) => x.id === subId) ?? null,
      expenses: st.expenses,
      paymentMethods: st.paymentMethods,
      base: st.settings.baseCurrency,
      rates: st.exchangeRates,
      update: st.updateSubscription,
      convertTrial: st.convertTrial,
      adopt: st.adoptSubscriptionPrice,
      applyPlan: st.applyPendingPlanChange,
      markPaid: st.markSubscriptionPaid,
      resume: st.resumeSubscription,
      reactivate: st.reactivateSubscription,
      remove: st.deleteSubscription,
      unlink: st.unlinkSubscriptionCharge,
    })),
  )
  const { sub } = s
  const [amountText, setAmountText] = useTypedAmount(sub ? chargeAmount(sub) : 0)
  const [currency, setCurrency] = useState<Currency | null>(sub?.currency ?? null)
  const [paymentMethodId, setPaymentMethodId] = useState(sub?.paymentMethodId ?? '')
  const [category, setCategory] = useState(sub?.expenseCategory ?? '')
  const [cycle, setCycle] = useState<SubscriptionBillingCycle | null>(sub?.billingCycle ?? null)
  const [sheet, setSheet] = useState<'category' | 'cycle' | null>(null)

  const today = localTodayISO()
  const row = useMemo(() => (sub ? buildRow(sub, s.expenses, parseISO(today), s.base, s.rates) : null), [sub, s.expenses, s.base, s.rates, today])
  const status = row?.status ?? 'active'
  const lastCharges = useMemo(
    () => (sub ? s.expenses.filter((e) => e.linkedSubscriptionId === sub.id && !e.refundKind).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3) : []),
    [sub, s.expenses],
  )

  if (!sub || !row) return null
  const cur = currency ?? sub.currency
  const every = cycle ?? sub.billingCycle
  const amount = Number.parseFloat(amountText.replace(',', '.')) || 0
  const shared = sub.myShare != null
  const amountChanged = !shared && amount > 0 && Math.abs(amount - sub.amount) > 0.004
  const dirty = amountChanged || cur !== sub.currency || (paymentMethodId || null) !== sub.paymentMethodId || category !== sub.expenseCategory || every !== sub.billingCycle
  // The header and the list look ahead: an unpaid past cycle shows as Payment due, never as the next charge.
  const nextIso = (row.life === 'active' ? row.nextDue : row.date) ?? undefined
  const nextText = nextIso ? shortDate(nextIso) : ''
  /** The cycle the status talks about: an unpaid one keeps its own (past) date. */
  const cycleText = row.date ? shortDate(row.date) : ''
  const life = row.life
  const ended = life === 'cancelled' || life === 'ended' || life === 'paused'

  const rate = cur !== s.base ? tryConvertCurrency(1, cur, s.base, s.rates) : null
  const conversion = rate != null && amount > 0
    ? c.rate(`${formatFixed2(convertCurrency(amount, cur, s.base, s.rates))} ${s.base}`, cur, formatFixed2(rate), s.base)
    : ''

  const save = () => {
    s.update(sub.id, {
      currency: cur,
      paymentMethodId: paymentMethodId || null,
      expenseCategory: category,
      billingCycle: every,
    })
    if (amountChanged) s.adopt(sub.id, amount)
    toast(t.common.saved)
    onClose()
  }

  const remove = async () => {
    if (await confirm({ title: c.deleteTitle(sub.name), body: c.deleteBody, confirmLabel: t.common.delete, destructive: true })) {
      s.remove(sub.id)
      onClose()
    }
  }

  // What Buddgy's checks found: a free trial, a declined charge, a shared plan, a new price or a plan change.
  const d = ui.detail.banner
  const note = (() => {
    if (ended) return null
    switch (row.chip.key) {
      case 'trialEnds': return { title: d.trial.title(sub.trialEnd ? shortDate(sub.trialEnd.slice(0, 10)) : ''), body: d.trial.body }
      case 'failed': return { title: d.failed.title(cycleText), body: d.failed.body }
      case 'shared': return { title: d.shared.title(formatFixed2(sub.amount)), body: d.shared.body((sub.sharedWith ?? []).join(', '), formatFixed2(chargeAmount(sub))) }
      case 'price': return { title: d.price.title(formatFixed2(row.priceChange?.to ?? chargeAmount(sub))), body: d.price.body(formatFixed2(chargeAmount(sub))) }
      case 'planChanges': return { title: d.plan.title('', sub.pendingPlanFrom ? shortDate(sub.pendingPlanFrom.slice(0, 10)) : ''), body: d.plan.body(formatFixed2(sub.pendingAmount ?? chargeAmount(sub))) }
      default: return null
    }
  })()

  // The next three charges (from the end of a trial, or the current cycle) and every price the plan has billed.
  const upcoming = ended
    ? []
    : scheduledDates(sub, life === 'trial' && sub.trialEnd ? parseISO(sub.trialEnd.slice(0, 10)) : (row.nextDue ? parseISO(row.nextDue) : startOfDay(parseISO(today))), addYears(parseISO(today), 4))
        .slice(0, 3)
        .map((x) => format(x, 'yyyy-MM-dd'))
  const upcomingAmount = (iso: string) =>
    sub.pendingPlanFrom && sub.pendingAmount != null && iso >= sub.pendingPlanFrom.slice(0, 10) ? sub.pendingAmount : (row.priceChange?.to ?? chargeAmount(sub))
  const history = priceHistoryNewestFirst(sub.priceHistory)

  // The one contextual action Buddgy's own checks raise: keep after a trial, a new price, a detected plan change, or an unpaid charge.
  const prompt = (() => {
    if (ended) return null
    if (life === 'trial') return { label: ui.detail.keepAfterTrial, run: () => s.convertTrial(sub.id) }
    if (row.priceChange) {
      const to = row.priceChange.to
      return { label: ui.detail.adopt(`${formatFixed2(to)} ${sub.currency}`), run: () => s.adopt(sub.id, to) }
    }
    if (sub.pendingPlanId) return { label: ui.detail.applyPlan, run: () => s.applyPlan(sub.id) }
    // Due today, in its grace days or overdue: the user can answer Buddgy's "did you pay?" here (HomeNudge opens this sheet).
    if (((row.cycle && row.cycle.kind !== 'upcoming') || status === 'needs_renewal') && markPaidTarget(sub, s.expenses) !== null) {
      return { label: ui.detail.markPaid, run: () => { s.markPaid(sub.id); toast(t.moneyFlows.markedPaid) } }
    }
    return null
  })()

  return (
    <>
      <SheetFrame
        open
        title={sub.name}
        onClose={onClose}
        headerStart={!ended && nextText ? <Pill icon={<Calendar />} className={HEADER_PILL}>{c.nextCharge(nextText)}</Pill> : undefined}
        headerActions={<V3SheetHeader.Action tone="danger" icon={<Trash2 />} label={t.common.delete} onClick={remove} />}
        footer={
          ended ? (
            <Button size="cta-block" onClick={() => { if (life === 'paused') s.resume(sub.id); else s.reactivate(sub.id); onClose() }}>
              {c.resubscribe}
            </Button>
          ) : (
            <>
              <Button size="cta-block" disabled={!dirty} onClick={save}>{c.save}</Button>
              {/* The approved sheet's footer is Save changes alone; cancelling stays one tap away as a quiet link, not a red one. */}
              <Button variant="ghost" size="touch" className="text-[0.8125rem] font-medium text-[var(--color-brand-text-secondary)]" onClick={() => onCancel(sub.id)}>{c.cancelLink}</Button>
            </>
          )
        }
      >
        <AmountHero
          value={amountText}
          onChange={setAmountText}
          currency={cur}
          onCurrencyChange={shared || ended ? undefined : (code) => setCurrency(code as Currency)}
          base={s.base}
          sign={`−${foreignSymbol(cur, s.base)}`}
          aria-label={ui.add.amount}
          top={
            <div className="flex flex-col items-center">
              <BrandTile brandKey={sub.brandKey} name={sub.name} size={52} />
              <p dir="auto" className="mt-2.5 text-[1.0625rem] font-semibold text-[var(--color-brand-text-primary)]">{sub.name}</p>
            </div>
          }
          line={conversion}
          className="px-0 pb-0"
        />
        <div className="-mt-2 flex flex-col items-center gap-1.5 text-center">
          <SubscriptionStatusBadge status={status} />
          <p className="text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
            {c.cycle[every]} · {c.statusLine[status](status === 'trial' && sub.trialEnd ? shortDate(sub.trialEnd.slice(0, 10)) : status === 'payment_due' ? cycleText : nextText)}
          </p>
        </div>

        {note ? (
          <div className="rounded-2xl bg-[var(--color-brand-primary-soft)] px-4 py-3">
            <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{note.title}</p>
            <p className="mt-0.5 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{note.body}</p>
          </div>
        ) : null}

        {prompt ? (
          <Button variant="outline" size="touch" className="w-full" onClick={prompt.run}>{prompt.label}</Button>
        ) : null}

        <SheetGroup>
          <MethodPickerRow label={c.paidWith} value={paymentMethodId} onChange={setPaymentMethodId} paymentMethods={s.paymentMethods} />
          <PickerRow label={c.category} value={t.expenseForm.categoryLabels[category as keyof typeof t.expenseForm.categoryLabels] ?? category} onClick={() => setSheet('category')} />
          <PickerRow label={c.repeatsLabel} value={c.repeats[every]} onClick={() => setSheet('cycle')} />
          <SettingsSwitchRow label={c.remind} hint={c.remindHelp} checked={sub.reminder ?? true} onChange={(v) => s.update(sub.id, { reminder: v })} />
        </SheetGroup>

        <SheetGroup label={c.lastCharges}>
          {lastCharges.length === 0 ? (
            <p className="flex min-h-11 items-center px-4 text-[0.84375rem] text-[var(--color-brand-text-muted)]">{pageCopy.noCharges}</p>
          ) : lastCharges.map((e) => (
            <div key={e.id} className="flex min-h-11 items-center gap-2 ps-4 pe-1.5 text-[0.84375rem]">
              <span className="flex-1 text-[var(--color-brand-text-secondary)]">{shortDate(e.date.slice(0, 10))}</span>
              <span dir="ltr" className="font-mono-numbers text-[var(--color-brand-text-primary)]">
                −{formatFixed2(e.amountInBaseCurrency)} {s.base}
                {e.currency !== s.base ? <span className="text-[var(--color-brand-text-muted)]"> · {formatFixed2(e.amount)} {e.currency}</span> : null}
              </span>
              <IconButton aria-label={ui.detail.unlink} size="sm" onClick={() => s.unlink(e.id)}>
                <Unlink strokeWidth={1.75} />
              </IconButton>
            </div>
          ))}
        </SheetGroup>

        {upcoming.length > 0 ? (
          <SheetGroup label={ui.detail.nextCharges}>
            {upcoming.map((iso) => (
              <div key={iso} className="flex min-h-11 items-center justify-between px-4 text-[0.84375rem]">
                <span className="text-[var(--color-brand-text-secondary)]">{shortDate(iso)}</span>
                <span dir="ltr" className="font-mono-numbers text-[var(--color-brand-text-primary)]">−{formatFixed2(upcomingAmount(iso))} {sub.currency}</span>
              </div>
            ))}
          </SheetGroup>
        ) : null}

        {history.length > 0 ? (
          <SheetGroup label={ui.detail.priceHistory}>
            {history.map((h, i) => (
              <div key={h.from + h.amount} className="flex min-h-11 items-center justify-between px-4 text-[0.84375rem]">
                <span className="text-[var(--color-brand-text-secondary)]">{i === 0 ? ui.detail.since(monthYear(h.from)) : ui.detail.before}</span>
                <span dir="ltr" className="font-mono-numbers text-[var(--color-brand-text-primary)]">{formatFixed2(h.amount)} {sub.currency}</span>
              </div>
            ))}
          </SheetGroup>
        ) : null}

        <Button variant="ghost" size="touch" className="self-center text-[0.8125rem] font-medium text-[var(--color-brand-text-secondary)]" onClick={() => onEdit(sub.id)}>
          {pageCopy.moreDetails}
        </Button>
      </SheetFrame>

      <OptionSheet
        open={sheet === 'category'}
        onClose={() => setSheet(null)}
        title={c.category}
        value={category}
        onChange={setCategory}
        options={EXPENSE_ENTRY_CATEGORIES.map((x) => ({ value: x as string, title: t.expenseForm.categoryLabels[x] ?? x }))}
        zIndexClassName="z-[110]"
      />
      <OptionSheet<SubscriptionBillingCycle>
        open={sheet === 'cycle'}
        onClose={() => setSheet(null)}
        title={c.repeatsLabel}
        value={every}
        onChange={setCycle}
        options={CYCLES.map((x) => ({ value: x, title: c.repeats[x] }))}
        zIndexClassName="z-[110]"
      />
    </>
  )
}
