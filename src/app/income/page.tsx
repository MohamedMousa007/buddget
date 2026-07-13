'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { addMonths, subMonths, format, parse } from 'date-fns'
import { ChevronLeft, ChevronRight, Link2 } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { MonthYearPicker } from '@/components/ui/MonthYearPicker'
import { RecurringIncomeCard } from '@/components/features/income/RecurringIncomeCard'
import { RecurringIncomeCarousel } from '@/components/features/income/RecurringIncomeCarousel'
import { SwipeToDelete, type SwipeSide } from '@/components/expenses/SwipeToDelete'
import { IncomeTypeIcon, incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
import { AccountChip } from '@/components/features/income/AccountChip'
import { GLASS_CARD } from '@/components/features/income/incomeGlass'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useT } from '@/lib/i18n'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { useHydrateIncome, useHydrateIncomeEvents, useHydrateDebts, useHydrateSavings } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { convertCurrency, fmtCompact } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { expectedRecurringForMonth, getMonthRange, recurringActiveForWindow } from '@/lib/utils/calculations'
import { buildOccurrences, isRealizedOccurrence, type IncomeOccurrence } from '@/lib/utils/incomeOccurrences'
import type { IncomeSource, IncomeSourceType } from '@/lib/store/types'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const MON_TITLE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const REALIZED_EVENT = new Set(['confirmed', 'late', 'partial'])

function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtDay(iso: string): string {
  return `${MON_TITLE[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`
}

/** Fields shared by recurring templates and one-time events for account display. */
type AcctLike = {
  linkedSavingsAccountId?: string
  linkedDebtId?: string
  paymentMethodId?: string
}

export default function IncomePage() {
  useHydrateIncome()
  useHydrateIncomeEvents()
  useHydrateDebts()
  useHydrateSavings()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const { incomeSources, incomeEvents, savingsAccounts, debts, paymentMethods, settings, exchangeRates, deleteIncomeEvent, deleteIncomeSource } =
    useFinanceStore(
      useShallow((s) => ({
        incomeSources: s.incomeSources,
        incomeEvents: s.incomeEvents,
        savingsAccounts: s.savingsAccounts,
        debts: s.debts,
        paymentMethods: s.paymentMethods,
        settings: s.settings,
        exchangeRates: s.exchangeRates,
        deleteIncomeEvent: s.deleteIncomeEvent,
        deleteIncomeSource: s.deleteIncomeSource,
      })),
    )
  const { monthFilter, setMonthFilter, setActiveModal, setEditingIncomeId, setEditingIncomeEventId, openAmountReceived, openAssignIncome } =
    useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const t = useT()
  const base = settings.baseCurrency
  const secondary = settings.secondaryCurrency
  const showSecondary = settings.showSecondaryCurrency && secondary

  const [activeCard, setActiveCard] = useState(0)
  const [selected, setSelected] = useState<{ sourceId: string; occKey: string } | null>(null)
  const [openRow, setOpenRow] = useState<{ id: string; side: SwipeSide } | null>(null)

  const parseMonth = (m: string) => parse(m, 'yyyy-MM', new Date())
  const prevMonth = () => setMonthFilter(format(subMonths(parseMonth(monthFilter), 1), 'yyyy-MM'))
  const nextMonth = () => setMonthFilter(format(addMonths(parseMonth(monthFilter), 1), 'yyyy-MM'))
  const navBtn =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] transition-colors hover:text-[var(--color-brand-text-primary)] active:translate-y-px'

  const openAddIncome = () => requireAuth(() => setActiveModal('addIncome'), t.income.requireAuth)

  const secondaryOf = (amountBase: number): string | null =>
    showSecondary && secondary ? `≈ ${formatCurrency(convertCurrency(amountBase, base, secondary, exchangeRates), secondary, false)}` : null

  const accountLabel = (s: AcctLike): string => {
    if (s.linkedSavingsAccountId) return savingsAccounts.find((a) => a.id === s.linkedSavingsAccountId)?.name ?? t.income.mainAccount
    if (s.linkedDebtId) return debts.find((d) => d.id === s.linkedDebtId)?.name ?? t.income.mainAccount
    if (s.paymentMethodId) return paymentMethods.find((m) => m.id === s.paymentMethodId)?.name ?? t.income.mainAccount
    return t.income.mainAccount
  }

  const cadenceLine = (s: IncomeSource): string => {
    const freq = s.recurringFrequency ?? 'monthly'
    if (freq === 'monthly') return `${t.addIncome.freqMonthly} · ${s.dayOfMonth ?? 1}`
    const label = freq === 'weekly' ? t.addIncome.freqWeekly : t.addIncome.freqBiweekly
    return s.paydayDays?.length ? `${label} · ${s.paydayDays.join(' / ')}` : label
  }

  const paymentLine = (s: IncomeSource) => <AccountChip label={accountLabel(s)} acct={s} paymentMethods={paymentMethods} />

  // Status suffix on a payday's date label — only the states that need flagging.
  const statusBracket = (o: IncomeOccurrence): string =>
    o.status === 'late' ? ` ${t.income.bracketLate}` : o.status === 'missed' ? ` ${t.income.bracketMissed}` : o.status === 'partial' ? ` ${t.income.bracketPartial}` : ''

  // Recurring sources active for the selected month.
  const recurring = useMemo(() => {
    const { start, end } = getMonthRange(monthFilter, settings.monthStartDay)
    return incomeSources.filter((s) => s.isRecurring && recurringActiveForWindow(s, start, end))
  }, [incomeSources, monthFilter, settings.monthStartDay])

  // Per-source occurrences + base-currency progress figures.
  const cards = useMemo(() => {
    return recurring.map((s) => {
      const occ = buildOccurrences(s, incomeEvents, monthFilter, settings.monthStartDay)
      const expectedBase = convertCurrency(expectedRecurringForMonth(s, monthFilter, settings.monthStartDay), s.currency, base, exchangeRates)
      const realizedBase = occ.reduce(
        (sum, o) => (isRealizedOccurrence(o) ? sum + convertCurrency(o.amount, o.currency, base, exchangeRates) : sum),
        0,
      )
      return { source: s, occ, expectedBase, realizedBase }
    })
  }, [recurring, incomeEvents, monthFilter, settings.monthStartDay, base, exchangeRates])

  // Standalone one-time receipts this month (unlinked events + legacy one-time sources).
  const oneTime = useMemo(() => {
    const covered = new Set(incomeEvents.filter((e) => !e.templateId).map((e) => e.id))
    const fromEvents = incomeEvents
      .filter((e) => !e.templateId && REALIZED_EVENT.has(e.status) && e.receivedDate.slice(0, 7) === monthFilter)
      .map((e) => ({ id: e.id, name: e.name, sourceType: e.sourceType, acct: e as AcctLike, amountBase: convertCurrency(e.amount, e.currency, base, exchangeRates), day: Number(e.receivedDate.slice(8, 10)) || 1, eventId: e.id as string | undefined, sourceId: undefined as string | undefined }))
    const fromSources = incomeSources
      .filter((s) => !s.isRecurring && !covered.has(s.id) && s.createdAt.slice(0, 7) === monthFilter)
      .map((s) => ({ id: s.id, name: s.name, sourceType: s.sourceType, acct: s as AcctLike, amountBase: convertCurrency(s.amount, s.currency, base, exchangeRates), day: Number(s.createdAt.slice(8, 10)) || 1, eventId: undefined as string | undefined, sourceId: s.id as string | undefined }))
    return [...fromEvents, ...fromSources]
  }, [incomeEvents, incomeSources, monthFilter, base, exchangeRates])

  // Summary numbers (base currency). Expected + Received are never merged.
  const expectedTotal = cards.reduce((s, c) => s + c.expectedBase, 0)
  const receivedTotal = cards.reduce((s, c) => s + c.realizedBase, 0)
  const oneTimeTotal = oneTime.reduce((s, o) => s + o.amountBase, 0)
  const pct = expectedTotal > 0 ? Math.round((receivedTotal / expectedTotal) * 100) : 0
  const toCome = Math.max(0, Math.round(expectedTotal - receivedTotal))

  // All-income ledger: recurring receipts + one-time, grouped by day (desc).
  const ledger = useMemo(() => {
    type Row = { id: string; name: string; sourceType?: IncomeSourceType; acct: AcctLike; amountBase: number; day: number; recurring: boolean; eventId?: string; sourceId?: string; canAssign: boolean }
    const rows: Row[] = []
    for (const e of incomeEvents) {
      if (!e.templateId || !REALIZED_EVENT.has(e.status) || e.receivedDate.slice(0, 7) !== monthFilter) continue
      rows.push({ id: `r-${e.id}`, name: e.name, sourceType: e.sourceType, acct: e as AcctLike, amountBase: convertCurrency(e.amount, e.currency, base, exchangeRates), day: Number(e.receivedDate.slice(8, 10)) || 1, recurring: true, eventId: e.id, canAssign: false })
    }
    for (const o of oneTime) {
      rows.push({ id: `o-${o.id}`, name: o.name, sourceType: o.sourceType, acct: o.acct, amountBase: o.amountBase, day: o.day, recurring: false, eventId: o.eventId, sourceId: o.sourceId, canAssign: Boolean(o.eventId) })
    }
    const monthIdx = (Number(monthFilter.split('-')[1]) || 1) - 1
    const map = new Map<number, Row[]>()
    for (const r of rows) {
      const arr = map.get(r.day)
      if (arr) arr.push(r)
      else map.set(r.day, [r])
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([day, items]) => ({ day, label: `${MONTHS[monthIdx]} ${day}`, total: items.reduce((s, r) => s + r.amountBase, 0), items }))
  }, [incomeEvents, oneTime, monthFilter, base, exchangeRates])

  const ledgerCount = ledger.reduce((s, g) => s + g.items.length, 0)

  const handleDelete = (row: { eventId?: string; sourceId?: string }) => {
    if (row.eventId) deleteIncomeEvent(row.eventId)
    else if (row.sourceId) deleteIncomeSource(row.sourceId)
  }

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  return (
    <div className="px-4 pb-32 pt-3.5">
      {/* Header: editorial month control (reused verbatim from Expenses) */}
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <MonthYearPicker monthFilter={monthFilter} onChange={setMonthFilter} heroLabel />
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" onClick={prevMonth} className={navBtn} aria-label="Previous month">
            <ChevronLeft className="h-[17px] w-[17px]" />
          </button>
          <button type="button" onClick={nextMonth} className={navBtn} aria-label="Next month">
            <ChevronRight className="h-[17px] w-[17px]" />
          </button>
        </div>
      </div>

      {/* Summary glass card — Expected vs Received (never merged) */}
      <div className="mb-5 p-4 text-white" style={GLASS_CARD}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">{t.income.expectedThisMonthLabel}</p>
            <p className="mt-1.5 font-mono-numbers text-[34px] font-bold leading-none tracking-[-1px]">
              {fmtNum(expectedTotal)} <span className="text-sm font-medium text-white/50">{base}</span>
            </p>
            {secondaryOf(expectedTotal) ? <p className="mt-1.5 font-mono-numbers text-xs text-white/45">{secondaryOf(expectedTotal)}</p> : null}
          </div>
          <div className="shrink-0 text-end">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">{t.income.receivedColLabel}</p>
            <p className="mt-1.5 font-mono-numbers text-[22px] font-bold leading-none text-[#35D46F]">{fmtNum(receivedTotal)}</p>
            {oneTimeTotal > 0 ? <p className="mt-1 font-mono-numbers text-[11px] font-semibold text-[#35D46F]">{t.income.oneTimeSuffix(fmtNum(oneTimeTotal))}</p> : null}
          </div>
        </div>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#35D46F] transition-[width] duration-300" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between font-mono-numbers text-[11px] text-white/55">
          <span>{t.income.pctOfExpected(pct)}</span>
          {toCome > 0 ? <span>{t.income.toCome(`${fmtNum(toCome)} ${base}`)}</span> : null}
        </div>

        <button
          type="button"
          onClick={openAddIncome}
          className="mt-4 w-full rounded-[14px] bg-[var(--color-brand-red)] py-3 text-sm font-bold text-white hover:bg-[var(--color-brand-red-hover)]"
        >
          {t.income.addIncomeCta}
        </button>
      </div>

      {/* Recurring carousel */}
      {cards.length > 0 ? (
        <div className="mb-6">
          <div className="mb-2.5 flex items-baseline justify-between px-1">
            <p className="text-sm font-bold text-[var(--color-brand-text-primary)]">
              {t.income.recurringHeading} <span className="ms-1 text-xs font-medium text-[var(--color-brand-text-muted)]">{t.income.sourcesCount(cards.length)}</span>
            </p>
            {cards.length > 1 ? <span className="text-[11px] text-[var(--color-brand-text-muted)]">{t.income.swipeHint}</span> : null}
          </div>
          <RecurringIncomeCarousel
            count={cards.length}
            activeIndex={activeCard}
            onActiveChange={setActiveCard}
            renderItem={(i) => {
              const { source, occ, expectedBase, realizedBase } = cards[i]
              const remaining = Math.round(expectedBase - realizedBase)
              const sel = selected?.sourceId === source.id ? occ.find((o) => o.key === selected.occKey) ?? null : null
              const progressLine = (
                <>
                  {t.income.receivedOfExpected(`${fmtCompact(realizedBase)} ${base}`, `${fmtCompact(expectedBase)} ${base}`)}
                  {' · '}
                  {remaining <= 0 ? <span className="text-[#35D46F]">{t.income.fullyReceived}</span> : t.income.toCome(`${fmtCompact(remaining)} ${base}`)}
                </>
              )
              return (
                <RecurringIncomeCard
                  sourceType={source.sourceType}
                  name={source.name}
                  cadenceLine={cadenceLine(source)}
                  paymentLine={paymentLine(source)}
                  expectedBig={fmtNum(expectedBase)}
                  expectedCurrency={base}
                  expectedTag={t.income.expectedPerMoLabel}
                  progressPct={expectedBase > 0 ? (realizedBase / expectedBase) * 100 : 0}
                  progressLine={progressLine}
                  occurrences={occ}
                  dateLabel={(o) => fmtDay(o.date)}
                  amountLabel={(o) => `${fmtCompact(o.amount)} ${o.currency}`}
                  statusBracket={statusBracket}
                  selectedKey={selected?.sourceId === source.id ? selected.occKey : null}
                  onChipTap={(o) =>
                    setSelected((prev) => (prev?.sourceId === source.id && prev.occKey === o.key ? null : { sourceId: source.id, occKey: o.key }))
                  }
                  onEdit={() => {
                    setEditingIncomeId(source.id)
                    setActiveModal('editIncome')
                  }}
                  editAriaLabel={t.income.editSourceAria}
                  footer={
                    !sel ? (
                      <p className="w-full text-center text-[11px] text-white/55">{t.income.tapPaydayTip}</p>
                    ) : !sel.actionable ? (
                      <p className="w-full text-center text-[11px] text-white/55">{t.income.earlierPaydayFirst}</p>
                    ) : (
                      <div className="grid w-full grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={!sel.eventId}
                          onClick={sel.eventId ? () => { deleteIncomeEvent(sel.eventId!); setSelected(null) } : undefined}
                          className="rounded-[14px] py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed enabled:bg-[var(--color-brand-red)] enabled:text-white enabled:hover:bg-[var(--color-brand-red-hover)] disabled:bg-white/[0.06] disabled:text-white/35"
                        >
                          {t.common.delete}
                        </button>
                        <button
                          type="button"
                          onClick={() => openAmountReceived(source.id, sel.key)}
                          className="rounded-[14px] bg-[var(--color-brand-green)] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--color-brand-green-hover)]"
                        >
                          {sel.eventId ? t.common.edit : t.income.receivedBtn}
                        </button>
                      </div>
                    )
                  }
                />
              )
            }}
          />
        </div>
      ) : null}

      {/* All income ledger */}
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <p className="text-sm font-bold text-[var(--color-brand-text-primary)]">{t.income.allIncomeHeading}</p>
        <span className="text-[11px] text-[var(--color-brand-text-muted)]">{t.income.thisMonthCount(ledgerCount)}</span>
      </div>
      {ledger.map((g) => (
        <div key={g.day}>
          <div className="flex items-baseline justify-between px-1 pb-2 pt-3">
            <span className="text-[15px] font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">{g.label}</span>
            <span className="font-mono-numbers whitespace-nowrap text-[11px] font-medium tabular-nums text-[var(--color-brand-text-muted)]">+{fmtNum(g.total)} {base}</span>
          </div>
          <div className="mb-2.5 overflow-hidden rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
            {g.items.map((r, idx) => {
              const colors = incomeTypeColors(r.sourceType)
              const clickable = Boolean(r.eventId || r.sourceId)
              const open = r.eventId
                ? () => { setEditingIncomeEventId(r.eventId!); setActiveModal('editIncomeEvent') }
                : r.sourceId
                  ? () => { setEditingIncomeId(r.sourceId!); setActiveModal('editIncome') }
                  : undefined
              return (
                <div key={r.id}>
                  {idx > 0 ? <div className="ml-[82px] h-px bg-[var(--color-brand-border)]" /> : null}
                  <SwipeToDelete
                    openSide={openRow?.id === r.id ? openRow.side : null}
                    onOpenChange={(side) => setOpenRow(side ? { id: r.id, side } : null)}
                    onDelete={() => handleDelete(r)}
                    deleteLabel={t.income.swipeDelete}
                    rightAction={
                      r.canAssign
                        ? { label: t.income.swipeAssign, icon: <Link2 className="h-5 w-5" />, onAction: () => r.eventId && openAssignIncome({ eventId: r.eventId }) }
                        : undefined
                    }
                  >
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={open}
                      className={`flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start transition-colors ${clickable ? 'hover:bg-[var(--color-brand-elevated)]' : 'cursor-default'}`}
                    >
                      <span className="flex w-[54px] flex-col items-center gap-[5px]">
                        <span className="flex h-10 w-10 items-center justify-center rounded-[11px]" style={{ background: colors.bg, color: colors.fg }}>
                          <IncomeTypeIcon type={r.sourceType} className="h-5 w-5" />
                        </span>
                        <span className="max-w-[54px] truncate text-center text-[9.5px] font-semibold leading-none" style={{ color: colors.fg }}>
                          {incomeSourceTypeLabel(t.income, r.sourceType)}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{r.name}</span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-[2.5px] text-[9.5px] font-extrabold uppercase tracking-[0.05em] ${r.recurring ? 'bg-[rgba(29,185,84,0.16)] text-[var(--color-brand-green)]' : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)]'}`}
                          >
                            {r.recurring ? t.income.recurringLabel : t.income.oneTimeLabel}
                          </span>
                        </div>
                        <span className="mt-1.5 block truncate text-xs text-[var(--color-brand-text-muted)]">→ {accountLabel(r.acct)}</span>
                      </div>
                      <span className="font-mono-numbers shrink-0 text-end text-[15px] font-medium tabular-nums text-[var(--color-brand-text-primary)]">+{fmtNum(r.amountBase)} <span className="text-[10px] font-medium text-[var(--color-brand-text-muted)]">{base}</span></span>
                    </button>
                  </SwipeToDelete>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {ledgerCount === 0 ? <p className="px-1 py-6 text-center text-sm text-[var(--color-brand-text-muted)]">{t.income.emptyTitle}</p> : null}
    </div>
  )
}
