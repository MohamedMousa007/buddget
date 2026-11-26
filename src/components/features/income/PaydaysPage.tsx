'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { addMonths, format, parseISO } from 'date-fns'
import { ArrowUpDown, ArrowUpRight, Briefcase, Building2, CalendarCog, Check, ChevronRight, Contrast, GripVertical, Plus, TrendingUp, X, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { OptionChip } from '@/components/ui/OptionChip'
import { SelectableCard } from '@/components/ui/SelectableCard'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { HeroBand } from '@/components/features/hero/HeroBand'
import { FlowLedger, type FlowLedgerRow } from '@/components/features/flow/FlowLedger'
import { BrandMark } from '@/components/features/accounts/BrandMark'
import { accountColor, accountTitle } from '@/components/features/accounts/accountDisplay'
import { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
import { PayCycleSheet } from '@/components/features/income/PayCycleSheet'
import { PaydayActionsCard } from '@/components/features/income/PaydayActionsCard'
import { paydayBadge } from '@/components/features/income/paydayBadge'
import { paydayMethodId, paydayMethodLabel } from '@/lib/income/paydayMethod'
import { paydayHeroFacts } from '@/lib/income/paydayHero'
import { paydayState, recentPaydays } from '@/lib/income/paydaySummary'
import { moveInOrder, sortOrderPatches } from '@/lib/income/paydayOrder'
import { registerBackGuard } from '@/lib/navigation/backGuard'
import { fillSlots } from '@/lib/ui/fillSlots'
import { tryConvertCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { usePaydaysLtCopy } from '@/lib/i18n/paydaysLtCopy'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { formatLocalized, intlTag } from '@/lib/i18n/dateFormat'
import { bankLogoForName } from '@/lib/payment/bankLogos'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore, type PaydayPrefill } from '@/lib/store/useSettingsStore'
import { getMonthRange, recurringActiveForWindow } from '@/lib/utils/calculations'
import { buildOccurrences, isRealizedOccurrence, type IncomeOccurrence } from '@/lib/utils/incomeOccurrences'
import { formatFlex, formatWhole } from '@/lib/utils/formatters'
import { toISODate } from '@/lib/utils/paydaySchedule'
import { useShortDate } from '@/hooks/useShortDate'
import { useWeekendFirstDay } from '@/hooks/useWeekStart'
import { useLocale, useT } from '@/lib/i18n'
import type { Dictionary } from '@/lib/i18n'
import type { IncomeSourceType, PaymentMethod } from '@/lib/store/types'

/** Every payday of the last two years reaches the history; the hero reads the same run. */
const RUN_LEN = 26

const STARTERS: { type: IncomeSourceType; icon: LucideIcon; name: keyof Dictionary['paydays']; sub: keyof Dictionary['paydays'] }[] = [
  { type: 'salary', icon: Briefcase, name: 'starterSalary', sub: 'starterSalarySub' },
  { type: 'rental', icon: Building2, name: 'starterRental', sub: 'starterRentalSub' },
  { type: 'investment', icon: TrendingUp, name: 'starterDividends', sub: 'starterDividendsSub' },
]

/**
 * Paydays (Light touch `page-paydays`): one payday at a time in the centred column. A rounded hero (type, cadence and
 * the account it lands in, the amount, next payday, on-time count and the last six paydays), Log a payday and Edit
 * payday, then its history. Other paydays are a chip row above the hero; add and pay cycle sit at the end. One-time
 * income never lives here: it is a row in Flow.
 */
export function PaydaysPage() {
  const t = useT()
  const c = usePaydaysLtCopy()
  const lt = useDebtsSubsLtCopy().payday
  const shortDate = useShortDate()
  const { locale } = useLocale()
  const weekendFirst = useWeekendFirstDay()
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
  const { monthFilter, openNewPayday, setActiveModal, setEditingIncomeId, openAmountReceived } = useSettingsStore(
    useShallow((s) => ({
      monthFilter: s.monthFilter,
      openNewPayday: s.openNewPayday,
      setActiveModal: s.setActiveModal,
      setEditingIncomeId: s.setEditingIncomeId,
      openAmountReceived: s.openAmountReceived,
    })),
  )
  // "Open in Paydays" from an income detail lands straight on that payday.
  const [pickedId, setPickedId] = useState<string | null>(() => useSettingsStore.getState().paydayFocusId)
  useEffect(() => {
    useSettingsStore.getState().setPaydayFocusId(null)
  }, [])
  const [cycleOpen, setCycleOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  // Reorder (the order Flow's In chips and the add-income picker follow): null = not reordering.
  const [order, setOrder] = useState<readonly string[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const reordering = order !== null

  // Hardware / gesture back leaves the reorder before leaving the page.
  useEffect(() => {
    if (!reordering) return
    return registerBackGuard(() => { setOrder(null); return true })
  }, [reordering])

  const streams = useMemo(() => {
    const { start, end } = getMonthRange(monthFilter, monthStartDay)
    return incomeSources
      .filter((s) => s.isRecurring && recurringActiveForWindow(s, start, end))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.createdAt.localeCompare(b.createdAt))
  }, [incomeSources, monthFilter, monthStartDay])
  const source = streams.find((s) => s.id === pickedId) ?? streams[0]

  // This month across every payday, each converted to the main currency (one with no rate is left out, never mixed in).
  const progress = useMemo(() => {
    let expected = 0
    let received = 0
    for (const s of streams) {
      for (const o of buildOccurrences(s, incomeEvents, monthFilter, monthStartDay)) {
        const e = tryConvertCurrency(s.amount, s.currency, base, rates)
        if (e == null) continue
        expected += e
        if (isRealizedOccurrence(o)) received += tryConvertCurrency(o.amount, o.currency, base, rates) ?? 0
      }
    }
    return { expected, received }
  }, [streams, incomeEvents, monthFilter, monthStartDay, base, rates])

  const today = useMemo(() => new Date(), [])
  // Up to next month, so the next payday is in the run even late in this one.
  const run = useMemo(
    () => (source ? recentPaydays(source, incomeEvents, format(addMonths(today, 1), 'yyyy-MM'), monthStartDay, RUN_LEN, today, weekendFirst) : []),
    [source, incomeEvents, monthStartDay, today, weekendFirst],
  )

  const add = (prefill?: PaydayPrefill) => openNewPayday(prefill)
  const column = 'mx-auto w-full max-w-[var(--page-max)] px-4 pb-6 pt-4 lg:px-6'

  if (!dataReady) {
    return (
      <div className={column}>
        <SkeletonList rows={4} />
      </div>
    )
  }

  if (!source) {
    return (
      <div className={column}>
        <div className="lg:mx-auto lg:mt-6 lg:max-w-md">
          <EmptyState
            variant="card"
            title={t.paydays.emptyTitle}
            description={t.paydays.emptyBody}
            action={<Button size="cta" onClick={() => add()}>{t.paydays.emptyCta}</Button>}
          />
        </div>
        <p className="mx-0.5 mb-2 mt-5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)] lg:text-center">
          {t.paydays.startWithOne}
        </p>
        <div className="flex flex-col gap-2 lg:grid lg:grid-cols-3 lg:gap-4">
          {STARTERS.map((s) => (
            <SelectableCard key={s.type} as="action" surface="card" layout="row" onClick={() => add({ sourceType: s.type, name: t.paydays[s.name] as string })}>
              <span className="flex w-full items-center gap-3 text-start">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">
                  <s.icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[0.9375rem] font-bold text-[var(--color-brand-text-primary)]">{t.paydays[s.name] as string}</span>
                  <span className="text-[0.78125rem] text-[var(--color-brand-text-secondary)]">{t.paydays[s.sub] as string}</span>
                </span>
                <ChevronRight className="size-[18px] text-[var(--color-brand-text-muted)] rtl:rotate-180" strokeWidth={2} aria-hidden />
              </span>
            </SelectableCard>
          ))}
        </div>
      </div>
    )
  }

  const facts = paydayHeroFacts(run, today)
  const freq = source.recurringFrequency ?? 'monthly'
  const freqLabel = freq === 'monthly' ? t.addIncome.freqMonthly : freq === 'weekly' ? t.addIncome.freqWeekly : t.addIncome.freqBiweekly
  const typeLabel = incomeSourceTypeLabel(t.income, source.sourceType)
  const account = paydayMethodLabel(source, paymentMethods)
  const toLog = run.find((o) => o.actionable && !isRealizedOccurrence(o))
  const selected = run.find((o) => o.key === selectedKey)
  const editPayday = () => {
    setEditingIncomeId(source.id)
    setActiveModal('editIncome')
  }

  const move = (id: string, to: number) => setOrder((prev) => (prev ? moveInOrder(prev, id, to) : prev))
  const commitOrder = () => {
    if (order) for (const p of sortOrderPatches(order, streams)) updateIncomeSource(p.id, { sortOrder: p.sortOrder })
    setOrder(null)
  }
  // Drag by the handle (mouse, touch or pen): the row under the pointer's Y is where the dragged one goes.
  const startDrag = (id: string) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setDragId(id)
    const onMove = (ev: PointerEvent) => {
      const items = Array.from(listRef.current?.children ?? []) as HTMLElement[]
      const idx = items.findIndex((el) => { const r = el.getBoundingClientRect(); return ev.clientY >= r.top && ev.clientY <= r.bottom })
      if (idx >= 0) move(id, idx)
    }
    const onUp = () => {
      setDragId(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }
  const handleKey = (id: string, i: number) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); move(id, i - 1) }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(id, i + 1) }
  }

  if (order) {
    const shown = order.map((id) => streams.find((s) => s.id === id)).filter((s): s is (typeof streams)[number] => Boolean(s))
    return (
      <div className={column}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-[0.8125rem] font-bold text-[var(--color-brand-text-primary)]">{t.paydays.reorderAria}</h2>
          <Button size="touch" onClick={commitOrder}>{t.common.done}</Button>
        </div>
        <p className="mx-0.5 mb-3 text-[0.78125rem] text-[var(--color-brand-text-secondary)]">{t.paydays.reorderHelp}</p>
        <Card padding="none" className="overflow-hidden">
          <div ref={listRef} className="divide-y divide-[var(--color-hairline)]">
            {shown.map((s, i) => {
              const acct = paydayMethodLabel(s, paymentMethods)
              return (
                <div key={s.id} className={cn('flex min-h-[60px] items-center gap-3 ps-4', dragId === s.id && 'bg-[var(--color-brand-elevated)]')}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]">
                    <IncomeTypeIcon type={s.sourceType} className="h-5 w-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span dir="auto" className="truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{s.name}</span>
                    <span className="truncate text-[0.78125rem] text-[var(--color-brand-text-secondary)]">
                      <span className="font-mono-numbers">{formatFlex(s.amount)}</span> {s.currency}{acct ? ` → ${acct}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`${t.paydays.dragHandle}: ${s.name}`}
                    onPointerDown={startDrag(s.id)}
                    onKeyDown={handleKey(s.id, i)}
                    className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-[var(--color-brand-text-muted)] active:cursor-grabbing"
                  >
                    <GripVertical className="size-5" aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    )
  }

  const monthName = new Intl.DateTimeFormat(intlTag(locale), { month: 'long' }).format(new Date(`${monthFilter}-01T00:00:00`))
  const todayISO = toISODate(today)
  const history = run.filter((o) => o.eventId || o.dueDate <= todayISO).reverse()
  const rows: FlowLedgerRow[] = history.map((o) => {
    const ev = o.eventId ? incomeEvents.find((e) => e.id === o.eventId) : undefined
    const state = paydayState(o, today)
    const arrived = shortDate(ev?.receivedDate ?? o.dueDate)
    const expectedOnly = !ev || state.kind === 'missed'
    // What arrived is shown in the currency it arrived in; an open or missed payday shows what was expected.
    const amount = expectedOnly ? source.amount : ev.amount
    const currency = expectedOnly ? source.currency : ev.currency
    const pm = paymentMethods.find((m) => m.id === (ev?.paymentMethodId || paydayMethodId(source, paymentMethods)))
    const badge = state.kind === 'received' || state.kind === 'arrivedLate' ? null : paydayBadge(state, t, shortDate(o.dueDate))
    return {
      key: o.key,
      selected: o.key === selectedKey,
      row: {
        icon: pm ? <AccountLogo method={pm} /> : <IncomeTypeIcon type={source.sourceType} className="h-5 w-5" />,
        iconBg: pm ? 'transparent' : 'var(--color-brand-green-soft)',
        iconFg: 'var(--color-brand-green)',
        onClick: () => setSelectedKey((k) => (k === o.key ? null : o.key)),
        title: c.rowTitle(typeLabel, formatLocalized(parseISO(o.dueDate), 'MMMM', locale)),
        titleBadge: badge ? <Badge variant={badge.variant} size="xs" className="shrink-0">{badge.label}</Badge> : undefined,
        subtitle: (
          <span className="truncate">
            {!ev
              ? state.kind === 'missed' ? c.missedSub(shortDate(o.dueDate)) : c.openSub(shortDate(o.dueDate))
              : state.kind === 'missed'
                ? c.missedSub(shortDate(o.dueDate))
                : state.kind === 'partial'
                  ? c.partialSub(arrived, formatFlex(ev.amount), formatFlex(source.amount))
                  : state.kind === 'arrivedLate'
                    ? c.lateSub(arrived, state.days)
                    : c.onTimeSub(arrived)}
          </span>
        ),
        amount: (
          <>
            <span className={state.kind === 'missed' ? 'line-through' : undefined}>{expectedOnly ? '' : '+'}{formatFlex(amount)}</span>{' '}
            <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{currency}</span>
          </>
        ),
        amountColor: expectedOnly ? 'var(--color-brand-text-muted)' : 'var(--color-brand-green)',
        sub: expectedOnly ? lt.expected : undefined,
      },
    }
  })

  return (
    <div className={column}>
      <PayCycleSheet open={cycleOpen} onClose={() => setCycleOpen(false)} />

      {streams.length > 1 ? (
        <div role="group" aria-label={c.sources} className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-0.5 lg:mx-0 lg:px-0">
          {streams.map((s) => (
            <OptionChip key={s.id} size="sm" surface="card" selected={s.id === source.id} onClick={() => { setPickedId(s.id); setSelectedKey(null) }}>
              {s.name}
            </OptionChip>
          ))}
        </div>
      ) : null}

      <HeroBand
        contained
        label={`${typeLabel} · ${freqLabel}${account ? ` → ${account}` : ''}`}
        numbers={
          <p className="flex min-w-0 items-baseline gap-1.5">
            <span className="font-mono-numbers text-[34px] font-semibold leading-none tracking-[-0.03em]">{formatFlex(source.amount)}</span>
            <span className="truncate text-[0.8125rem] text-[var(--flow-band-fg-2)]">{freq === 'monthly' ? c.eachMonth(source.currency) : c.eachPayday(source.currency)}</span>
          </p>
        }
        note={
          <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-[0.8125rem]">
            {facts.next ? (
              <span>{c.nextPayday} <b className="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">{shortDate(facts.next.dueDate)}</b></span>
            ) : null}
            {facts.last.length ? (
              <span>{c.onTime} <b className="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">{c.ofN(facts.onTime, facts.last.length)}</b></span>
            ) : null}
          </span>
        }
        extra={facts.last.length ? <MonthCircles occ={facts.last} today={today} locale={locale} selectedKey={selectedKey} onSelect={(k) => setSelectedKey((cur) => (cur === k ? null : k))} /> : undefined}
      />

      {account ? null : (
        <Button variant="ghost" size="touch" onClick={editPayday} className="mt-1 px-1 text-[var(--color-brand-text-secondary)]">
          {c.noAccount}
          <ChevronRight aria-hidden className="rtl:rotate-180" />
        </Button>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Button size="touch" disabled={!toLog} onClick={() => toLog && openAmountReceived(source.id, toLog.key, toLog.dueDate.slice(0, 7))} className="rounded-2xl">
          <Plus aria-hidden />
          {lt.logPayday}
        </Button>
        <Button variant="secondary" size="touch" onClick={editPayday} className="rounded-2xl">
          <ArrowUpRight aria-hidden />
          {lt.editPayday}
        </Button>
      </div>

      {selected ? <PaydayActionsCard source={source} occ={selected} /> : null}

      {rows.length ? (
        <>
          <p className="mx-0.5 mb-1.5 mt-[18px] text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{c.history}</p>
          <div className="lg:-mx-4">
            <FlowLedger look="card" groups={[{ key: 'history', rows }]} />
          </div>
        </>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-1">
        <Button variant="ghost" size="touch" onClick={() => add()} className="px-2 text-[var(--color-brand-primary-ink)]">
          <Plus aria-hidden />
          {c.addPayday}
        </Button>
        <Button variant="ghost" size="touch" onClick={() => setCycleOpen(true)} className="px-2 text-[var(--color-brand-text-secondary)]">
          <CalendarCog aria-hidden />
          {c.payCycle}
        </Button>
        {streams.length > 1 ? (
          <Button variant="ghost" size="touch" onClick={() => setOrder(streams.map((s) => s.id))} className="px-2 text-[var(--color-brand-text-secondary)]">
            <ArrowUpDown aria-hidden />
            {t.paydays.reorderAria}
          </Button>
        ) : null}
      </div>
      {progress.expected > 0 ? (
        <p className="mx-0.5 mt-1 text-[0.78125rem] text-[var(--color-brand-text-secondary)]">
          {fillSlots(t.paydays.receivedLine, {
            month: monthName,
            received: <b className="font-mono-numbers text-[var(--color-brand-text-primary)]">{formatWhole(progress.received)}</b>,
            expected: <span className="font-mono-numbers">{formatWhole(progress.expected)}</span>,
            currency: base,
          })}
        </p>
      ) : null}
      <p className="mx-0.5 mt-1 text-[0.78125rem] leading-[1.45] text-[var(--color-brand-text-muted)]">{t.paydays.oneTimeNote}</p>
    </div>
  )
}

function AccountLogo({ method }: { method: PaymentMethod }) {
  const title = accountTitle(method)
  return <BrandMark name={title} color={accountColor(method)} size={40} logo={bankLogoForName(title)} />
}

/** The last paydays as circles on the band: a check when it arrived, half when partly, a cross when missed. */
function MonthCircles({ occ, today, locale, selectedKey, onSelect }: {
  occ: IncomeOccurrence[]
  today: Date
  locale: Parameters<typeof formatLocalized>[2]
  selectedKey: string | null
  onSelect: (key: string) => void
}) {
  const c = usePaydaysLtCopy()
  return (
    <ol className="mt-3 flex justify-between gap-1">
      {occ.map((o) => {
        const k = paydayState(o, today).kind
        const got = k === 'received' || k === 'arrivedLate'
        const Icon = got ? Check : k === 'partial' ? Contrast : X
        const state = k === 'received' ? c.states.received : k === 'arrivedLate' || k === 'late' ? c.states.late : k === 'partial' ? c.states.partial : c.states.missed
        const label = formatLocalized(parseISO(o.dueDate), 'MMM', locale)
        return (
          <li key={o.key}>
            {/* Tapping a payday opens its actions under the buttons (log, mark missed, undo), as the old timeline did. */}
            <button
              type="button"
              aria-label={c.monthCircle(label, state)}
              aria-pressed={selectedKey === o.key}
              onClick={() => onSelect(o.key)}
              className="flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-xl"
            >
              <span
                aria-hidden
                className={cn('flex size-8 items-center justify-center rounded-full border-2 border-[var(--flow-band-fg)] [&_svg]:size-4', selectedKey === o.key && 'ring-2 ring-[var(--flow-band-fg)] ring-offset-2 ring-offset-[var(--flow-band-a)]')}
                style={got ? { background: 'var(--flow-band-fg)', color: 'var(--flow-band-a)' } : { color: 'var(--flow-band-fg)' }}
              >
                <Icon strokeWidth={2.75} />
              </span>
              <span aria-hidden className="text-[0.6875rem] font-semibold">{label}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
