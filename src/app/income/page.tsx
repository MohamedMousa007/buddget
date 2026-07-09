'use client'

import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Plus, TrendingUp, RefreshCw } from 'lucide-react'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { MonthNavigationControl } from '@/components/layout/MonthNavigationControl'
import { IncomeTypeIcon, incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useT } from '@/lib/i18n'
import { useHydrateIncome, useHydrateIncomeEvents, useHydrateDebts, useHydrateSavings } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { getMonthRange, recurringActiveForWindow, isIncomeOccurrencePending } from '@/lib/utils/calculations'
import type { IncomeSource, IncomeSourceType, IncomeEvent, IncomeEventStatus, Currency } from '@/lib/store/types'

/** Fields the tab renders for both recurring templates and one-time events. */
type IncomeLike = {
  sourceType?: IncomeSourceType
  amount: number
  currency: Currency
  linkedSavingsAccountId?: string
  linkedDebtId?: string
  paymentMethodId?: string
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function fmtNum(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function monthlyEquivalent(source: IncomeSource): number {
  const freq = source.recurringFrequency ?? 'monthly'
  if (freq === 'weekly') return (source.amount * 52) / 12
  if (freq === 'biweekly') return (source.amount * 26) / 12
  return source.amount
}

export default function IncomePage() {
  useHydrateIncome()
  useHydrateIncomeEvents()
  useHydrateDebts()
  useHydrateSavings()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const { incomeSources, incomeEvents, savingsAccounts, debts, paymentMethods, settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      incomeEvents: s.incomeEvents,
      savingsAccounts: s.savingsAccounts,
      debts: s.debts,
      paymentMethods: s.paymentMethods,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
    })),
  )
  const { monthFilter, setMonthFilter, setActiveModal, setEditingIncomeId, setEditingIncomeEventId } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const t = useT()
  const base = settings.baseCurrency
  const secondary = settings.secondaryCurrency
  const showSecondary = settings.showSecondaryCurrency && secondary

  const openAddIncome = () => requireAuth(() => setActiveModal('addIncome'), t.income.requireAuth)
  const toBase = (s: IncomeLike) => convertCurrency(s.amount, s.currency, base, exchangeRates)

  const accountLabel = (s: IncomeLike): string => {
    if (s.linkedSavingsAccountId) return savingsAccounts.find((a) => a.id === s.linkedSavingsAccountId)?.name ?? t.income.mainAccount
    if (s.linkedDebtId) return debts.find((d) => d.id === s.linkedDebtId)?.name ?? t.income.mainAccount
    if (s.paymentMethodId) return paymentMethods.find((m) => m.id === s.paymentMethodId)?.name ?? t.income.mainAccount
    return t.income.mainAccount
  }

  const freqLabel = (s: IncomeSource): string => {
    const freq = s.recurringFrequency ?? 'monthly'
    if (freq === 'weekly') return t.income.freqWeeklyShort
    if (freq === 'biweekly') return t.income.freqBiweeklyShort
    return t.income.freqMonthlyDay(s.dayOfMonth ?? 1)
  }

  // Status chip copy + color for an actual event vs its expected occurrence.
  const statusChip = (status: IncomeEventStatus): { label: string; cls: string } => {
    switch (status) {
      case 'late': return { label: t.income.statusLate, cls: 'bg-[rgba(245,200,66,0.16)] text-[var(--color-brand-gold)]' }
      case 'partial': return { label: t.income.statusPartial, cls: 'bg-[rgba(245,200,66,0.16)] text-[var(--color-brand-gold)]' }
      case 'missed': return { label: t.income.statusMissed, cls: 'bg-[rgba(229,9,20,0.14)] text-[var(--color-brand-red)]' }
      case 'projected': return { label: t.income.statusPending, cls: 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)]' }
      default: return { label: t.income.statusReceived, cls: 'bg-[rgba(29,185,84,0.14)] text-[var(--color-brand-green)]' }
    }
  }
  const today = new Date()

  // Recurring sources active for the selected month (respects effective start/end
  // so an ended source no longer inflates the total).
  const recurring = useMemo(() => {
    const { start, end } = getMonthRange(monthFilter, settings.monthStartDay)
    return incomeSources.filter((s) => s.isRecurring && recurringActiveForWindow(s, start, end))
  }, [incomeSources, monthFilter, settings.monthStartDay])
  // One-time income for the month: realized ledger events, plus any legacy one-time
  // source not yet superseded by an event (de-duped by id, matching actualIncomeForMonth).
  const oneTimeThisMonth = useMemo(() => {
    const realized = new Set(['confirmed', 'late', 'partial'])
    const covered = new Set(incomeEvents.filter((e) => !e.templateId).map((e) => e.id))
    const fromEvents = incomeEvents
      .filter((e) => !e.templateId && realized.has(e.status) && e.receivedDate.slice(0, 7) === monthFilter)
      .map((e) => ({ id: e.id, name: e.name, payload: e as IncomeLike, day: Number(e.receivedDate.slice(8, 10)) || 1, sourceType: e.sourceType, eventId: e.id }))
    const fromSources = incomeSources
      .filter((s) => !s.isRecurring && !covered.has(s.id) && s.createdAt.slice(0, 7) === monthFilter)
      .map((s) => ({ id: s.id, name: s.name, payload: s as IncomeLike, day: Number(s.createdAt.slice(8, 10)) || 1, sourceType: s.sourceType, eventId: undefined as string | undefined }))
    return [...fromEvents, ...fromSources]
  }, [incomeEvents, incomeSources, monthFilter])

  // Actual received events for the month, grouped by the template they fulfill.
  const eventsByTemplate = useMemo(() => {
    const m = new Map<string, IncomeEvent[]>()
    for (const e of incomeEvents) {
      if (!e.templateId || e.receivedDate.slice(0, 7) !== monthFilter) continue
      const arr = m.get(e.templateId)
      if (arr) arr.push(e)
      else m.set(e.templateId, [e])
    }
    return m
  }, [incomeEvents, monthFilter])

  const monthlyTotal = useMemo(
    () => recurring.reduce((sum, s) => sum + convertCurrency(monthlyEquivalent(s), s.currency, base, exchangeRates), 0),
    [recurring, base, exchangeRates],
  )
  // Monthly-equivalent of a source in base currency (bi-weekly/weekly normalized to /mo).
  const toBaseMonthly = (s: IncomeSource) => convertCurrency(monthlyEquivalent(s), s.currency, base, exchangeRates)
  const monthlyUsd = showSecondary && secondary
    ? formatCurrency(convertCurrency(monthlyTotal, base, secondary, exchangeRates), secondary, false)
    : null

  // "Other income this month": unlinked one-time events + legacy one-time sources, grouped by day.
  // (Recurring income now renders with its actual events under the templates section above.)
  const incomeGroups = useMemo(() => {
    type Row = { id: string; name: string; source: IncomeLike; day: number; recurring: boolean; eventId?: string; sourceId?: string }
    const rows: Row[] = []
    for (const o of oneTimeThisMonth) {
      // Legacy one-time sources (no event) open the source editor; events open the event editor.
      rows.push({ id: `o-${o.id}`, name: o.name, source: o.payload, day: o.day, recurring: false, eventId: o.eventId, sourceId: o.eventId ? undefined : o.id })
    }
    rows.sort((a, b) => b.day - a.day)
    const monthIdx = (Number(monthFilter.split('-')[1]) || 1) - 1
    const map = new Map<number, Row[]>()
    for (const r of rows) {
      const arr = map.get(r.day)
      if (arr) arr.push(r)
      else map.set(r.day, [r])
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([day, items]) => ({
        day,
        label: `${MONTHS[monthIdx]} ${day}`,
        total: items.reduce((sum, r) => sum + toBase(r.source), 0),
        items,
      }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toBase is an inline closure over base/exchangeRates
  }, [oneTimeThisMonth, monthFilter, base, exchangeRates])

  if (!dataReady) return <div className="p-4"><SkeletonList /></div>

  return (
    <div className="px-4 pb-32 pt-3.5">
      {/* Header row: month switcher · add source */}
      <div className="mb-3.5 flex items-center gap-2">
        <MonthNavigationControl monthFilter={monthFilter} onChange={setMonthFilter} compact />
        <button
          type="button"
          onClick={openAddIncome}
          className="flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-red)] text-sm font-bold text-white hover:bg-[var(--color-brand-red-hover)]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          {t.income.addSource}
        </button>
      </div>

      {/* Monthly income + counts */}
      <div className="mb-4 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-[16px_18px] dark:bg-[linear-gradient(150deg,#101913,#101017)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-brand-text-muted)]">
              {t.income.monthlyIncomeLabel}
            </p>
            <p className="font-mono-numbers mt-1.5 text-3xl font-bold leading-none tracking-[-0.5px] text-[var(--color-brand-text-primary)]">
              {fmtNum(monthlyTotal)}{' '}
              <span className="text-xs font-medium text-[var(--color-brand-text-muted)]">{base}</span>
            </p>
            {monthlyUsd ? (
              <p className="font-mono-numbers mt-1 text-xs text-[var(--color-brand-text-muted)]">≈ {monthlyUsd}</p>
            ) : null}
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[rgba(29,185,84,0.12)] text-[var(--color-brand-green)]">
            <TrendingUp className="h-6 w-6" />
          </span>
        </div>
        <div className="my-3.5 h-px bg-[var(--color-brand-border)]" />
        <div className="flex gap-3.5">
          <div className="flex flex-1 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[rgba(29,185,84,0.13)] text-[var(--color-brand-green)]">
              <RefreshCw className="h-4 w-4" />
            </span>
            <div>
              <p className="font-mono-numbers text-base font-bold leading-none text-[var(--color-brand-text-primary)]">{recurring.length}</p>
              <p className="mt-0.5 text-[10px] text-[var(--color-brand-text-muted)]">{t.income.recurringLabel}</p>
            </div>
          </div>
          <div className="w-px bg-[var(--color-brand-border)]" />
          <div className="flex flex-1 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[rgba(245,200,66,0.13)] text-[var(--color-brand-gold)]">
              <Plus className="h-4 w-4" />
            </span>
            <div>
              <p className="font-mono-numbers text-base font-bold leading-none text-[var(--color-brand-text-primary)]">{oneTimeThisMonth.length}</p>
              <p className="mt-0.5 text-[10px] text-[var(--color-brand-text-muted)]">{t.income.oneTimeLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recurring sources (first) */}
      <p className="mb-2.5 px-1 text-xs font-bold uppercase tracking-[0.06em] text-[var(--color-brand-text-muted)]">
        {t.income.recurringSourcesLabel}
      </p>
      <div className="mb-5 flex flex-col gap-2.5">
        {recurring.map((s) => {
          const colors = incomeTypeColors(s.sourceType)
          const events = [...(eventsByTemplate.get(s.id) ?? [])].sort(
            (a, b) => b.receivedDate.localeCompare(a.receivedDate) || b.createdAt.localeCompare(a.createdAt),
          )
          const pending = events.length === 0 && isIncomeOccurrencePending(s, incomeEvents, monthFilter, today, settings.monthStartDay)
          // Progress toward the month's expected amount (cumulative, base currency).
          const expectedMonthly = toBaseMonthly(s)
          const receivedTotal = events.reduce((sum, e) => sum + convertCurrency(e.amount, e.currency, base, exchangeRates), 0)
          const remaining = Math.round(expectedMonthly - receivedTotal)
          const receivedOfExpected = t.income.receivedOfExpected(`${fmtNum(receivedTotal)} ${base}`, `${fmtNum(expectedMonthly)} ${base}`)
          const progressLabel =
            remaining > 0
              ? `${receivedOfExpected} · ${t.income.remainingLeft(`${fmtNum(remaining)} ${base}`)}`
              : remaining === 0
                ? `${receivedOfExpected} · ${t.income.fullyReceived}`
                : `${receivedOfExpected} · ${t.income.extraReceived(`${fmtNum(-remaining)} ${base}`)}`
          return (
            <div key={s.id} className="overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
              {/* Template header (projection) */}
              <button
                type="button"
                onClick={() => { setEditingIncomeId(s.id); setActiveModal('editIncome') }}
                className="flex w-full items-center gap-3 p-3.5 text-start hover:bg-[var(--color-brand-elevated)]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ background: colors.bg, color: colors.fg }}>
                  <IncomeTypeIcon type={s.sourceType} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--color-brand-text-primary)]">{s.name}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--color-brand-text-muted)]">
                    {events.length > 0 ? progressLabel : `${freqLabel(s)} · ${t.income.expectedPerMonth(`${fmtNum(expectedMonthly)} ${base}`)}`}
                  </p>
                </div>
                {pending ? (
                  <span className="shrink-0 rounded-full bg-[var(--color-brand-elevated)] px-2 py-0.5 text-xs font-bold uppercase tracking-[0.04em] text-[var(--color-brand-text-muted)]">
                    {t.income.statusPending}
                  </span>
                ) : null}
              </button>
              {/* Actual received events for the month */}
              {events.map((e) => {
                const chip = statusChip(e.status)
                const actual = convertCurrency(e.amount, e.currency, base, exchangeRates)
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => { setEditingIncomeEventId(e.id); setActiveModal('editIncomeEvent') }}
                    className="flex w-full items-center gap-3 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)]/40 px-3.5 py-2.5 text-start hover:bg-[var(--color-brand-elevated)]"
                  >
                    <span className="ms-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brand-text-muted)]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-[var(--color-brand-text-secondary)]">{e.receivedDate.slice(5)}</span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.03em] ${chip.cls}`}>{chip.label}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="font-mono-numbers text-sm font-bold text-[var(--color-brand-text-primary)]">+{fmtNum(actual)} <span className="text-[10px] font-medium text-[var(--color-brand-text-muted)]">{base}</span></p>
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}
        {recurring.length === 0 ? (
          <p className="px-1 py-2 text-xs text-[var(--color-brand-text-muted)]">{t.income.emptyDesc}</p>
        ) : null}
      </div>

      {/* Other (one-time / unlinked) income this month */}
      <p className="mb-2.5 px-1 text-xs font-bold uppercase tracking-[0.06em] text-[var(--color-brand-text-muted)]">
        {t.income.otherIncomeLabel}
      </p>
      {incomeGroups.map((g) => (
        <div key={g.day}>
          <div className="flex items-center justify-between px-1 pb-1.5 pt-2.5">
            <span className="text-xs font-bold uppercase tracking-[0.05em] text-[var(--color-brand-text-muted)]">{g.label}</span>
            <span className="font-mono-numbers text-xs font-semibold text-[var(--color-brand-text-muted)]">+{fmtNum(g.total)} {base}</span>
          </div>
          <div className="mb-2.5 overflow-hidden rounded-lg border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
            {g.items.map((r, idx) => {
              const colors = incomeTypeColors(r.source.sourceType)
              const clickable = Boolean(r.eventId || r.sourceId)
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={!clickable}
                  onClick={
                    r.eventId
                      ? () => { setEditingIncomeEventId(r.eventId!); setActiveModal('editIncomeEvent') }
                      : r.sourceId
                        ? () => { setEditingIncomeId(r.sourceId!); setActiveModal('editIncome') }
                        : undefined
                  }
                  className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-start ${idx === 0 ? '' : 'border-t border-[var(--color-brand-border)]'} ${clickable ? 'hover:bg-[var(--color-brand-elevated)]' : 'cursor-default'}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ background: colors.bg, color: colors.fg }}>
                    <IncomeTypeIcon type={r.source.sourceType} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{r.name}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-extrabold uppercase tracking-[0.04em] ${r.recurring ? 'bg-[rgba(29,185,84,0.14)] text-[var(--color-brand-green)]' : 'bg-[rgba(245,200,66,0.14)] text-[var(--color-brand-gold)]'}`}
                      >
                        {r.recurring ? t.income.recurringLabel : t.income.oneTimeLabel}
                      </span>
                    </div>
                    <span className="block truncate text-xs text-[var(--color-brand-text-muted)]">→ {accountLabel(r.source)}</span>
                  </div>
                  <span className="font-mono-numbers shrink-0 text-sm font-bold text-[var(--color-brand-text-primary)]">+{fmtNum(toBase(r.source))} <span className="text-[10px] font-medium text-[var(--color-brand-text-muted)]">{base}</span></span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {incomeGroups.length === 0 ? (
        <p className="px-1 py-6 text-center text-sm text-[var(--color-brand-text-muted)]">{t.income.emptyTitle}</p>
      ) : null}
    </div>
  )
}
