'use client'

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ArrowUpDown, Briefcase, CalendarCog, Building2, ChevronLeft, ChevronRight, Plus, TrendingUp, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { EmptyState } from '@/components/ui/EmptyState'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { PageContainer } from '@/components/layout/PageContainer'
import { StatusBarCover } from '@/components/layout/StatusBarCover'
import { PaydayCard, type PaydayBadgeVariant } from '@/components/features/income/PaydayCard'
import { PaydayDetail } from '@/components/features/income/PaydayDetail'
import { PayCycleSheet } from '@/components/features/income/PayCycleSheet'
import { methodLabel } from '@/components/features/flow/useFlowLedger'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore, type PaydayPrefill } from '@/lib/store/useSettingsStore'
import { navigate } from '@/lib/navigation/navigate'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { getMonthRange, recurringActiveForWindow } from '@/lib/utils/calculations'
import { buildOccurrences, isRealizedOccurrence } from '@/lib/utils/incomeOccurrences'
import { convertCurrency } from '@/lib/utils/currency'
import { formatFlex, formatWhole } from '@/lib/utils/formatters'
import { shortDate } from '@/lib/utils/shortDate'
import { focusPayday, isLate, overdueDays } from '@/lib/income/paydaySummary'
import { cadenceLine } from '@/lib/income/cadence'
import { cn } from '@/lib/utils'
import { fillSlots } from '@/lib/ui/fillSlots'
import { useLocale, useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n'
import type { IncomeEvent, IncomeSource, IncomeSourceType } from '@/lib/store/types'

/** The one status a payday card carries for this month. */
function cardStatus(source: IncomeSource, events: IncomeEvent[], month: string, monthStartDay: number, t: Dictionary): { variant: PaydayBadgeVariant; label: string } {
  const today = new Date()
  const occ = buildOccurrences(source, events, month, monthStartDay, today)
  const focus = focusPayday(occ, today)
  if (!focus) return { variant: 'muted', label: t.income.statusPending }
  if (!focus.eventId) {
    const late = overdueDays(focus, today)
    if (late > 0 && isLate(source, focus, today)) return { variant: 'warning', label: t.income.daysLateChip(late) }
    return { variant: 'muted', label: t.paydays.dueOn(shortDate(focus.dueDate)) }
  }
  if (focus.status === 'missed') return { variant: 'muted', label: t.income.statusMissed }
  if (focus.status === 'partial') return { variant: 'brand', label: t.income.statusPartial }
  if (focus.daysLate) return { variant: 'warning', label: t.paydays.arrivedLateShort(focus.daysLate) }
  return { variant: 'positive', label: t.income.statusReceived }
}

const STARTERS: { type: IncomeSourceType; icon: LucideIcon; name: keyof Dictionary['paydays']; sub: keyof Dictionary['paydays'] }[] = [
  { type: 'salary', icon: Briefcase, name: 'starterSalary', sub: 'starterSalarySub' },
  { type: 'rental', icon: Building2, name: 'starterRental', sub: 'starterRentalSub' },
  { type: 'investment', icon: TrendingUp, name: 'starterDividends', sub: 'starterDividendsSub' },
]

/**
 * Paydays: income setup, reached from Flow's header and the profile menu. One card per
 * recurring stream with this month's status; tap for the timeline and actions; reorder by
 * handle (the order Flow's In chips and the add-income picker follow). One-time income
 * never lives here — it is a row in Flow.
 */
export function PaydaysPage() {
  const t = useT()
  const { locale } = useLocale()
  const { dataReady, incomeSources, incomeEvents, paymentMethods, monthStartDay, base, rates, updateIncomeSource } = useFinanceStore(
    useShallow((s) => ({
      dataReady: s.dataReady,
      incomeSources: s.incomeSources,
      incomeEvents: s.incomeEvents,
      paymentMethods: s.paymentMethods,
      monthStartDay: s.settings.monthStartDay,
      base: s.settings.baseCurrency,
      rates: s.exchangeRates,
      updateIncomeSource: s.updateIncomeSource,
    })),
  )
  const { monthFilter, openNewPayday } = useSettingsStore(
    useShallow((s) => ({ monthFilter: s.monthFilter, openNewPayday: s.openNewPayday })),
  )
  // "Open in Paydays" from an income detail lands straight on that payday.
  const [openId, setOpenId] = useState<string | null>(() => useSettingsStore.getState().paydayFocusId)
  useEffect(() => {
    useSettingsStore.getState().setPaydayFocusId(null)
  }, [])
  const [order, setOrder] = useState<string[] | null>(null)
  const [cycleOpen, setCycleOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const streams = useMemo(() => {
    const { start, end } = getMonthRange(monthFilter, monthStartDay)
    return incomeSources
      .filter((s) => s.isRecurring && recurringActiveForWindow(s, start, end))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt.localeCompare(b.createdAt))
  }, [incomeSources, monthFilter, monthStartDay])

  const reordering = order !== null
  const shown = reordering ? order.map((id) => streams.find((s) => s.id === id)).filter((s): s is IncomeSource => Boolean(s)) : streams
  const detail = openId ? streams.find((s) => s.id === openId) : undefined

  // Hardware / gesture back steps out of the detail or reorder before leaving the page.
  useEffect(() => {
    if (!openId && !reordering) return
    return registerBackGuard(() => {
      if (openId) setOpenId(null)
      else setOrder(null)
      return true
    })
  }, [openId, reordering])

  const progress = useMemo(() => {
    let expected = 0
    let received = 0
    for (const s of streams) {
      for (const o of buildOccurrences(s, incomeEvents, monthFilter, monthStartDay)) {
        expected += convertCurrency(s.amount, s.currency, base, rates)
        if (isRealizedOccurrence(o)) received += convertCurrency(o.amount, o.currency, base, rates)
      }
    }
    return { expected, received }
  }, [streams, incomeEvents, monthFilter, monthStartDay, base, rates])

  const monthName = new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-US', { month: 'long' }).format(new Date(`${monthFilter}-01T00:00:00`))

  const commitOrder = () => {
    order?.forEach((id, i) => {
      if ((streams.find((s) => s.id === id)?.sortOrder ?? -1) !== i) updateIncomeSource(id, { sortOrder: i })
    })
    setOrder(null)
  }

  const move = (id: string, to: number) =>
    setOrder((prev) => {
      if (!prev) return prev
      const from = prev.indexOf(id)
      const clamped = Math.max(0, Math.min(prev.length - 1, to))
      if (from === clamped) return prev
      const next = [...prev]
      next.splice(from, 1)
      next.splice(clamped, 0, id)
      return next
    })

  // Drag by the handle: the card under the pointer's Y is where the dragged one goes.
  const startDrag = (id: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setDragId(id)
    const onMove = (ev: PointerEvent) => {
      const cards = Array.from(listRef.current?.children ?? []) as HTMLElement[]
      const idx = cards.findIndex((c) => {
        const r = c.getBoundingClientRect()
        return ev.clientY >= r.top && ev.clientY <= r.bottom
      })
      if (idx >= 0) move(id, idx)
    }
    const onUp = () => {
      setDragId(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const header = (actions: React.ReactNode) => (
    <div className="flex min-h-14 items-center gap-1 pe-2.5 ps-1.5 pt-1">
      <IconButton variant="ghost" size="md" aria-label={t.paydays.backToFlow} onClick={() => navigate('/flow')}>
        <ChevronLeft className="size-5" strokeWidth={2} />
      </IconButton>
      <span className="flex-1 text-2xl font-bold tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{t.nav.paydays}</span>
      {actions}
    </div>
  )

  const add = (prefill?: PaydayPrefill) => openNewPayday(prefill)

  return (
    <PageContainer wide className="px-0 lg:px-6">
      <StatusBarCover background="var(--color-brand-bg)" />
      <PayCycleSheet open={cycleOpen} onClose={() => setCycleOpen(false)} />
      {!dataReady ? (
        <>
          {header(null)}
          <div className="mx-4 mt-3.5">
            <SkeletonList rows={4} />
          </div>
        </>
      ) : streams.length === 0 ? (
        <div className="mx-auto max-w-[var(--page-max)] lg:max-w-none">
          {header(null)}
          <div className="mx-4 mt-6 lg:mx-auto lg:mt-10 lg:max-w-md">
            <EmptyState
              title={t.paydays.emptyTitle}
              description={t.paydays.emptyBody}
              action={
                <Button size="cta" onClick={() => add()}>
                  {t.paydays.emptyCta}
                </Button>
              }
            />
          </div>
          <p className="mx-[18px] my-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)] lg:mx-0 lg:mt-8 lg:text-center">
            {t.paydays.startWithOne}
          </p>
          <div className="mx-4 flex flex-col gap-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-4">
            {STARTERS.map((s) => (
              <SelectableCard key={s.type} as="action" surface="card" layout="row" onClick={() => add({ sourceType: s.type, name: t.paydays[s.name] as string })}>
                <span className="flex w-full items-center gap-3 text-start">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">
                    <s.icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-bold text-[var(--color-brand-text-primary)]">{t.paydays[s.name] as string}</span>
                    <span className="text-[12.5px] text-[var(--color-brand-text-secondary)]">{t.paydays[s.sub] as string}</span>
                  </span>
                  <ChevronRight className="size-[18px] text-[var(--color-brand-text-muted)]" strokeWidth={2} aria-hidden />
                </span>
              </SelectableCard>
            ))}
          </div>
        </div>
      ) : (
        <div className={detail ? 'lg:grid lg:grid-cols-[26rem_minmax(0,1fr)] lg:items-start lg:gap-x-6' : 'mx-auto max-w-[var(--page-max)] lg:max-w-none'}>
        <div className={cn(detail && 'hidden lg:block lg:border-e lg:border-[var(--color-hairline)] lg:pe-6')}>
          {header(
            reordering ? (
              <Button size="touch" onClick={commitOrder}>
                {t.common.done}
              </Button>
            ) : (
              <div className="flex gap-1">
                <IconButton variant="ghost" size="md" aria-label={locale === 'ar' ? 'دورة الراتب' : 'Pay cycle'} onClick={() => setCycleOpen(true)}>
                  <CalendarCog className="size-5" strokeWidth={1.75} />
                </IconButton>
                <IconButton variant="ghost" size="md" aria-label={t.paydays.reorderAria} onClick={() => setOrder(streams.map((s) => s.id))}>
                  <ArrowUpDown className="size-5" strokeWidth={1.75} />
                </IconButton>
                <Button size="touch" onClick={() => add()}>
                  <Plus className="size-4" strokeWidth={2.25} />
                  {t.paydays.add}
                </Button>
              </div>
            ),
          )}
          <div className="mx-[18px] mt-1.5 flex flex-col gap-2 lg:mx-0">
            <p className="text-[13px] text-[var(--color-brand-text-secondary)]">
              {fillSlots(t.paydays.receivedLine, {
                month: monthName,
                received: <b className="font-mono-numbers text-[var(--color-brand-text-primary)]">{formatWhole(progress.received)}</b>,
                expected: <span className="font-mono-numbers">{formatWhole(progress.expected)}</span>,
                currency: base,
              })}
            </p>
            <div className="h-1.5 rounded-full bg-[var(--color-brand-elevated)]">
              <div
                className="h-full rounded-full bg-[var(--color-brand-green)]"
                style={{ width: `${progress.expected > 0 ? Math.min(100, (progress.received / progress.expected) * 100) : 0}%` }}
              />
            </div>
          </div>
          {reordering ? (
            <p className="mx-[18px] mt-3.5 text-[12.5px] text-[var(--color-brand-text-secondary)] lg:mx-0">{t.paydays.reorderHelp}</p>
          ) : null}
          <div ref={listRef} className={cn('mx-4 mt-3.5 flex flex-col gap-2.5 lg:mx-0', !detail && !reordering && 'lg:grid lg:grid-cols-2 lg:gap-4 xl:grid-cols-3', reordering && !detail && 'lg:max-w-[var(--page-max)]')}>
            {shown.map((s, i) => {
              const pm = methodLabel(paymentMethods.find((m) => m.id === s.paymentMethodId))
              return (
                <PaydayCard
                  key={s.id}
                  type={s.sourceType}
                  name={s.name}
                  cadence={cadenceLine(s, t)}
                  destination={pm ? `→ ${pm}` : t.paydays.paidIntoNotSet}
                  destinationMissing={!pm}
                  amount={formatFlex(s.amount)}
                  status={cardStatus(s, incomeEvents, monthFilter, monthStartDay, t)}
                  onOpen={() => setOpenId(s.id)}
                  reorder={
                    reordering
                      ? {
                          dragging: dragId === s.id,
                          handleLabel: t.paydays.dragHandle,
                          onHandlePointerDown: startDrag(s.id),
                          onHandleKeyDown: (e) => {
                            if (e.key === 'ArrowUp') { e.preventDefault(); move(s.id, i - 1) }
                            if (e.key === 'ArrowDown') { e.preventDefault(); move(s.id, i + 1) }
                          },
                        }
                      : undefined
                  }
                />
              )
            })}
          </div>
          {!reordering ? (
            <p className="mx-[18px] mt-4 text-[12.5px] leading-[1.45] text-[var(--color-brand-text-muted)] lg:mx-0">{t.paydays.oneTimeNote}</p>
          ) : null}
        </div>
        {detail ? (
          <div className="min-w-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-[var(--color-brand-border)] lg:bg-[var(--color-brand-card)]">
            <PaydayDetail source={detail} onBack={() => setOpenId(null)} />
          </div>
        ) : null}
        </div>
      )}
    </PageContainer>
  )
}
