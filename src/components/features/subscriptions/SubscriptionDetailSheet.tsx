'use client'

import { addYears, format, parseISO, startOfDay } from 'date-fns'
import { Ban, Check, Clock, Link as LinkIcon, Pause, Repeat, TrendingUp, TriangleAlert, Unlink, Users, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/button'
import { useActionToast } from '@/components/ui/ActionToast'
import { useConfirm } from '@/components/ui/dialog/DialogProvider'
import { IconButton } from '@/components/ui/IconButton'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { useSubscriptionDates } from '@/hooks/useSubscriptionDates'
import { useLocale, useT } from '@/lib/i18n'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import type { SubscriptionTracking } from '@/lib/store/types'
import { localTodayISO } from '@/lib/utils/localDate'
import { findBrandByKey, plansForRegion, type CatalogRegion } from '@/lib/constants/subscriptionCatalog'
import { chargeAmount, markPaidTarget, scheduledDates } from '@/lib/subscriptions/subscriptionForecast'
import { buildRow, type Chip } from '@/lib/subscriptions/subscriptionRows'
import { cn } from '@/lib/utils'
import { BrandTile } from './BrandTile'
import { SectionLabel, SheetFrame } from './SheetFrame'
import { chipLabel, currencyLabel, cycleWord, TRACKING_ICON } from './subscriptionLabels'
import { StatusChip } from './StatusChip'
import { formatFixed2 } from '@/lib/utils/formatters'

const TRACKING: SubscriptionTracking[] = ['sms', 'ask', 'log']

type BannerKind = 'trial' | 'paused' | 'cancelled' | 'price' | 'plan' | 'overdue' | 'failed' | 'shared'
const BANNER_BY_CHIP: Partial<Record<Chip['key'], BannerKind>> = {
  trialEnds: 'trial',
  paused: 'paused',
  ends: 'cancelled',
  price: 'price',
  planChanges: 'plan',
  expected: 'overdue',
  failed: 'failed',
  shared: 'shared',
}
const BANNER_ICON: Record<BannerKind, LucideIcon> = {
  trial: Clock,
  paused: Pause,
  cancelled: Ban,
  price: TrendingUp,
  plan: Repeat,
  overdue: Clock,
  failed: TriangleAlert,
  shared: Users,
}
const BANNER_TONE: Record<BannerKind, string> = {
  trial: 'bg-[var(--color-brand-primary-soft)]',
  plan: 'bg-[var(--color-brand-primary-soft)]',
  shared: 'bg-[var(--color-brand-primary-soft)]',
  price: 'bg-[var(--color-brand-amber-soft)]',
  overdue: 'bg-[var(--color-brand-amber-soft)]',
  failed: 'bg-[var(--color-brand-amber-soft)]',
  paused: 'bg-[var(--color-brand-elevated)]',
  cancelled: 'bg-[var(--color-brand-elevated)]',
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl border border-[var(--color-brand-border)]">
      {children}
    </div>
  )
}

/** One subscription in full: state, next charges, tracking, matched charges, price history, actions. */
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
  const { locale } = useLocale()
  const ui = t.subscriptions.ui
  const confirm = useConfirm()
  const toast = useActionToast()
  const { shortDate: formatDateShort, monthYear } = useSubscriptionDates()
  const [pickTracking, setPickTracking] = useState(false)
  const s = useFinanceStore(
    useShallow((st) => ({
      sub: st.subscriptions.find((x) => x.id === subId) ?? null,
      expenses: st.expenses,
      base: st.settings.baseCurrency,
      rates: st.exchangeRates,
      update: st.updateSubscription,
      markPaid: st.markSubscriptionPaid,
      adopt: st.adoptSubscriptionPrice,
      applyPlan: st.applyPendingPlanChange,
      convertTrial: st.convertTrial,
      pause: st.pauseSubscription,
      resume: st.resumeSubscription,
      reactivate: st.reactivateSubscription,
      remove: st.deleteSubscription,
      unlink: st.unlinkSubscriptionCharge,
    })),
  )
  const { sub } = s
  const today = localTodayISO()
  const row = useMemo(
    () => (sub ? buildRow(sub, s.expenses, parseISO(today), s.base, s.rates) : null),
    [sub, s.expenses, s.base, s.rates, today],
  )

  const upcoming = useMemo(() => {
    if (!sub || !row) return []
    if (row.life !== 'active' && row.life !== 'trial') return []
    const from = row.life === 'trial' && sub.trialEnd ? parseISO(sub.trialEnd.slice(0, 10)) : (row.cycle?.due ?? startOfDay(parseISO(today)))
    const price = row.priceChange?.to ?? chargeAmount(sub)
    return scheduledDates(sub, from, addYears(from, 4))
      .slice(0, 3)
      .map((d) => {
        const iso = format(d, 'yyyy-MM-dd')
        const moved = sub.pendingPlanId && sub.pendingPlanFrom && sub.pendingAmount != null && iso >= sub.pendingPlanFrom.slice(0, 10)
        return { iso, amount: moved ? (sub.pendingAmount as number) : price }
      })
  }, [sub, row, today])

  const matched = useMemo(
    () =>
      sub
        ? s.expenses
            .filter((e) => e.linkedSubscriptionId === sub.id && !e.refundKind)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5)
        : [],
    [sub, s.expenses],
  )

  if (!sub || !row) return null
  const life = row.life
  const charge = chargeAmount(sub)
  const bannerKind = BANNER_BY_CHIP[row.chip.key]
  const BannerIcon = bannerKind ? BANNER_ICON[bannerKind] : null
  const d = ui.detail.banner
  const fmt = (n: number) => formatFixed2(n)
  const pendingBrand = findBrandByKey(sub.brandKey)
  const pendingPlanName =
    (pendingBrand && sub.catalogRegion
      ? plansForRegion(pendingBrand, sub.catalogRegion as CatalogRegion).find((p) => p.id === sub.pendingPlanId)?.name
      : undefined) ?? ''
  const shortDate = (iso: string) => formatDateShort(iso)

  const banner = (() => {
    switch (bannerKind) {
      case 'trial':
        return { title: d.trial.title(shortDate(sub.trialEnd ?? '')), body: d.trial.body }
      case 'paused':
        return { title: d.paused.title, body: d.paused.body(sub.pausedAt ? shortDate(sub.pausedAt.slice(0, 10)) : '') }
      case 'cancelled':
        return { title: d.cancelled.title(sub.endsOn ? shortDate(sub.endsOn.slice(0, 10)) : ''), body: d.cancelled.body }
      case 'price':
        return { title: d.price.title(fmt(row.priceChange?.to ?? charge)), body: d.price.body(fmt(charge)) }
      case 'plan':
        return {
          title: d.plan.title(pendingPlanName, sub.pendingPlanFrom ? shortDate(sub.pendingPlanFrom.slice(0, 10)) : ''),
          body: d.plan.body(fmt(sub.pendingAmount ?? charge)),
        }
      case 'overdue':
        return { title: d.overdue.title(row.date ? shortDate(row.date) : ''), body: d.overdue.body }
      case 'failed':
        return { title: d.failed.title(row.date ? shortDate(row.date) : ''), body: d.failed.body }
      case 'shared':
        return { title: d.shared.title(fmt(sub.amount)), body: d.shared.body((sub.sharedWith ?? []).join(', '), fmt(charge)) }
      default:
        return null
    }
  })()

  const canMarkPaid = markPaidTarget(sub, s.expenses) !== null
  const footer = (() => {
    if (life === 'trial') return { label: ui.detail.keepAfterTrial, run: () => s.convertTrial(sub.id) }
    if (life === 'paused') return { label: ui.detail.resume, run: () => s.resume(sub.id) }
    if (life === 'cancelled' || life === 'ended') return { label: ui.detail.resubscribe, run: () => s.reactivate(sub.id) }
    if (row.priceChange) {
      const to = row.priceChange.to
      return { label: ui.detail.adopt(`${currencyLabel(sub.currency, locale)} ${fmt(to)}`), run: () => s.adopt(sub.id, to) }
    }
    if (sub.pendingPlanId) return { label: ui.detail.applyPlan, run: () => s.applyPlan(sub.id) }
    return canMarkPaid ? { label: ui.detail.markPaid, run: () => { s.markPaid(sub.id); toast(t.moneyFlows.markedPaid) } } : null
  })()

  const history = [...(sub.priceHistory ?? [])].sort((a, b) => b.from.localeCompare(a.from))
  const Track = TRACKING_ICON[sub.tracking ?? 'sms']
  const canCancel = life === 'active' || life === 'trial' || life === 'paused'

  const remove = async () => {
    if (await confirm({ title: t.subscriptions.confirmDeleteSubscription, destructive: true })) {
      s.remove(sub.id)
      onClose()
    }
  }

  return (
    <SheetFrame
      open
      onClose={onClose}
      title={ui.detail.title}
      footer={
        footer ? (
          <Button
            size="cta-block"
            onClick={() => {
              footer.run()
              if (life === 'active' && !row.priceChange && !sub.pendingPlanId) onClose()
            }}
          >
            {footer.label}
          </Button>
        ) : undefined
      }
    >
      <div className="flex items-center gap-3.5">
        <BrandTile brandKey={sub.brandKey} name={sub.name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold text-[var(--color-brand-text-primary)]">{sub.name}</div>
          <div className="truncate text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{sub.planName ?? ui.chips.subscription}</div>
        </div>
        <StatusChip tone={row.chip.tone} icon={row.chip.icon}>
          {chipLabel(row.chip, ui, shortDate)}
        </StatusChip>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono-numbers text-[28px] font-semibold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{fmt(charge)}</span>
        <span className="text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
          {currencyLabel(sub.currency, locale)} {cycleWord(sub.billingCycle, ui)}
        </span>
      </div>

      {banner && BannerIcon && bannerKind ? (
        <div className={cn('flex items-start gap-2.5 rounded-2xl px-3.5 py-3', BANNER_TONE[bannerKind])}>
          <BannerIcon className="mt-px size-[18px] shrink-0 text-[var(--color-brand-text-primary)]" strokeWidth={1.75} aria-hidden />
          <div className="flex-1">
            <div className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{banner.title}</div>
            <div className="mt-0.5 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">{banner.body}</div>
          </div>
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <SectionLabel>{ui.detail.nextCharges}</SectionLabel>
        {upcoming.length > 0 ? (
          <Group>
            {upcoming.map((c) => (
              <div key={c.iso} className="flex min-h-11 items-center justify-between px-3.5 text-sm">
                <span className="font-mono-numbers">{shortDate(c.iso)}</span>
                <span className="font-mono-numbers font-semibold">{fmt(c.amount)}</span>
              </div>
            ))}
          </Group>
        ) : (
          <p className="py-1 text-[0.8125rem] text-[var(--color-brand-text-secondary)]">
            {life === 'paused' ? ui.detail.noChargesPaused : ui.detail.noCharges}
          </p>
        )}
      </section>

      <div className="rounded-2xl border border-[var(--color-brand-border)]">
        <div className="flex min-h-14 items-center gap-3 px-3.5">
          <Track className="size-[18px] text-[var(--color-brand-text-secondary)]" strokeWidth={1.75} aria-hidden />
          <div className="flex-1">
            <div className="text-xs text-[var(--color-brand-text-secondary)]">{ui.detail.tracking}</div>
            <div className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{ui.tracking[sub.tracking ?? 'sms'].name}</div>
          </div>
          <Button variant="link" size="touch" className="px-2 text-[0.8125rem] font-semibold text-[var(--color-brand-primary-ink)] no-underline" onClick={() => setPickTracking(!pickTracking)}>
            {ui.detail.change}
          </Button>
        </div>
        {pickTracking ? (
          <div role="radiogroup" aria-label={ui.detail.tracking} className="flex flex-col gap-2 border-t border-[var(--color-brand-border)] p-3">
            {TRACKING.map((m) => {
              const Icon = TRACKING_ICON[m]
              const selected = (sub.tracking ?? 'sms') === m
              return (
                <SelectableCard
                  key={m}
                  layout="row"
                  selected={selected}
                  onClick={() => {
                    s.update(sub.id, { tracking: m })
                    setPickTracking(false)
                  }}
                  className="min-h-14 gap-3 px-3 py-2.5"
                >
                  <Icon className="size-5 shrink-0 text-[var(--color-brand-text-secondary)]" strokeWidth={1.75} aria-hidden />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-semibold">{ui.tracking[m].name}</span>
                    <span className="text-xs text-[var(--color-brand-text-secondary)]">{ui.tracking[m].hint}</span>
                  </span>
                  {selected ? <Check className="size-[18px] text-[var(--color-brand-primary-ink)]" strokeWidth={1.75} aria-hidden /> : null}
                </SelectableCard>
              )
            })}
          </div>
        ) : null}
      </div>

      {matched.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionLabel>{ui.detail.matched}</SectionLabel>
          <Group>
            {matched.map((e) => (
              <div key={e.id} className="flex min-h-12 items-center gap-2.5 ps-3.5 pe-1.5 text-[0.8125rem]">
                <LinkIcon className="size-3.5 text-[var(--color-brand-text-muted)]" strokeWidth={1.75} aria-hidden />
                <span className="flex-1">{e.smsLogId ? ui.detail.smsCharge(shortDate(e.date)) : ui.detail.manualCharge(shortDate(e.date))}</span>
                <span className="font-mono-numbers font-semibold">{fmt(e.amount)}</span>
                <IconButton aria-label={ui.detail.unlink} onClick={() => s.unlink(e.id)}>
                  <Unlink strokeWidth={1.75} />
                </IconButton>
              </div>
            ))}
          </Group>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="flex flex-col gap-2">
          <SectionLabel>{ui.detail.priceHistory}</SectionLabel>
          <Group>
            {history.map((h, i) => (
              <div key={h.from + h.amount} className="flex min-h-11 items-center justify-between px-3.5 text-[0.8125rem]">
                <span className="text-[var(--color-brand-text-secondary)]">
                  {i === 0 ? ui.detail.since(monthYear(h.from)) : ui.detail.before}
                </span>
                <span className="font-mono-numbers font-semibold">{fmt(h.amount)}</span>
              </div>
            ))}
          </Group>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="touch" onClick={() => onEdit(sub.id)}>
          {ui.detail.edit}
        </Button>
        {life === 'paused' ? (
          <Button variant="outline" size="touch" onClick={() => s.resume(sub.id)}>
            {ui.detail.resume}
          </Button>
        ) : life === 'active' || life === 'trial' ? (
          <Button variant="outline" size="touch" onClick={() => s.pause(sub.id)}>
            {ui.detail.pause}
          </Button>
        ) : null}
        {canCancel ? (
          <Button variant="destructive" size="touch" onClick={() => onCancel(sub.id)}>
            {ui.detail.cancel}
          </Button>
        ) : (
          <Button variant="destructive" size="touch" onClick={remove}>
            {ui.detail.delete}
          </Button>
        )}
      </div>
    </SheetFrame>
  )
}
