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
import { getMonthRange, recurringActiveForWindow } from '@/lib/utils/calculations'
import type { IncomeSource, IncomeSourceType, Currency } from '@/lib/store/types'

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

  const monthlyTotal = useMemo(
    () => recurring.reduce((sum, s) => sum + convertCurrency(monthlyEquivalent(s), s.currency, base, exchangeRates), 0),
    [recurring, base, exchangeRates],
  )
  // Monthly-equivalent of a source in base currency (bi-weekly/weekly normalized to /mo).
  const toBaseMonthly = (s: IncomeSource) => convertCurrency(monthlyEquivalent(s), s.currency, base, exchangeRates)
  const monthlyUsd = showSecondary && secondary
    ? formatCurrency(convertCurrency(monthlyTotal, base, secondary, exchangeRates), secondary)
    : null

  // "Income this month": recurring received on their day-of-month + one-time created this month, grouped by day.
  const incomeGroups = useMemo(() => {
    type Row = { id: string; name: string; source: IncomeLike; day: number; recurring: boolean; eventId?: string }
    const rows: Row[] = []
    for (const s of recurring) {
      rows.push({ id: `r-${s.id}`, name: s.name, source: s, day: s.dayOfMonth ?? 1, recurring: true })
    }
    for (const o of oneTimeThisMonth) {
      rows.push({ id: `o-${o.id}`, name: o.name, source: o.payload, day: o.day, recurring: false, eventId: o.eventId })
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurring, oneTimeThisMonth, monthFilter, base, exchangeRates])

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
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => { setEditingIncomeId(s.id); setActiveModal('editIncome') }}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-3.5 text-start"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ background: colors.bg, color: colors.fg }}>
                <IncomeTypeIcon type={s.sourceType} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--color-brand-text-primary)]">{s.name}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--color-brand-text-muted)]">{freqLabel(s)} · → {accountLabel(s)}</p>
              </div>
              <div className="shrink-0 text-end">
                <p className="font-mono-numbers text-base font-bold text-[var(--color-brand-text-primary)]">+{fmtNum(toBaseMonthly(s))}</p>
                <p className="mt-px text-[10px] text-[var(--color-brand-text-muted)]">{base} {t.income.perMoSuffix}</p>
                {(s.recurringFrequency ?? 'monthly') !== 'monthly' ? (
                  <p className="font-mono-numbers mt-px text-[10px] text-[var(--color-brand-text-muted)]">
                    {fmtNum(toBase(s))} {base}/{s.recurringFrequency === 'weekly' ? 'wk' : 'pay'}
                  </p>
                ) : null}
              </div>
            </button>
          )
        })}
        {recurring.length === 0 ? (
          <p className="px-1 py-2 text-xs text-[var(--color-brand-text-muted)]">{t.income.emptyDesc}</p>
        ) : null}
      </div>

      {/* Income this month */}
      <p className="mb-2.5 px-1 text-xs font-bold uppercase tracking-[0.06em] text-[var(--color-brand-text-muted)]">
        {t.income.incomeThisMonthLabel}
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
              const clickable = Boolean(r.eventId)
              return (
                <button
                  key={r.id}
                  type="button"
                  disabled={!clickable}
                  onClick={clickable ? () => { setEditingIncomeEventId(r.eventId!); setActiveModal('editIncomeEvent') } : undefined}
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
