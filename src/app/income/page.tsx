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
import { useHydrateIncome, useHydrateDebts, useHydrateSavings } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import type { IncomeSource } from '@/lib/store/types'

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
  useHydrateDebts()
  useHydrateSavings()
  const dataReady = useFinanceStore((s) => s.dataReady)
  const { incomeSources, savingsAccounts, debts, paymentMethods, settings, exchangeRates } = useFinanceStore(
    useShallow((s) => ({
      incomeSources: s.incomeSources,
      savingsAccounts: s.savingsAccounts,
      debts: s.debts,
      paymentMethods: s.paymentMethods,
      settings: s.settings,
      exchangeRates: s.exchangeRates,
    })),
  )
  const { monthFilter, setMonthFilter, setActiveModal, setEditingIncomeId } = useSettingsStore()
  const requireAuth = useRequireAuthAction()
  const t = useT()
  const base = settings.baseCurrency
  const secondary = settings.secondaryCurrency
  const showSecondary = settings.showSecondaryCurrency && secondary

  const openAddIncome = () => requireAuth(() => setActiveModal('addIncome'), t.income.requireAuth)
  const toBase = (s: IncomeSource) => convertCurrency(s.amount, s.currency, base, exchangeRates)

  const accountLabel = (s: IncomeSource): string => {
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

  const recurring = useMemo(() => incomeSources.filter((s) => s.isRecurring), [incomeSources])
  const oneTimeThisMonth = useMemo(
    () => incomeSources.filter((s) => !s.isRecurring && s.createdAt.slice(0, 7) === monthFilter),
    [incomeSources, monthFilter],
  )

  const monthlyTotal = useMemo(
    () => recurring.reduce((sum, s) => sum + convertCurrency(monthlyEquivalent(s), s.currency, base, exchangeRates), 0),
    [recurring, base, exchangeRates],
  )
  const monthlyUsd = showSecondary && secondary
    ? formatCurrency(convertCurrency(monthlyTotal, base, secondary, exchangeRates), secondary)
    : null

  // "Income this month": recurring received on their day-of-month + one-time created this month, grouped by day.
  const incomeGroups = useMemo(() => {
    type Row = { id: string; name: string; source: IncomeSource; day: number; recurring: boolean }
    const rows: Row[] = []
    for (const s of recurring) {
      rows.push({ id: `r-${s.id}`, name: s.name, source: s, day: s.dayOfMonth ?? 1, recurring: true })
    }
    for (const s of oneTimeThisMonth) {
      rows.push({ id: `o-${s.id}`, name: s.name, source: s, day: Number(s.createdAt.slice(8, 10)) || 1, recurring: false })
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
    <div className="px-4 pb-[130px] pt-[14px]">
      {/* Header row: month switcher · add source */}
      <div className="mb-[13px] flex items-center gap-2">
        <MonthNavigationControl monthFilter={monthFilter} onChange={setMonthFilter} compact />
        <button
          type="button"
          onClick={openAddIncome}
          className="flex h-10 min-w-0 flex-1 items-center justify-center gap-[7px] rounded-[12px] bg-[var(--color-brand-red)] text-[13.5px] font-bold text-white hover:bg-[var(--color-brand-red-hover)]"
        >
          <Plus className="h-[17px] w-[17px]" strokeWidth={2.4} />
          {t.income.addSource}
        </button>
      </div>

      {/* Monthly income + counts */}
      <div className="mb-4 rounded-[20px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-[16px_18px] dark:bg-[linear-gradient(150deg,#101913,#101017)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--color-brand-text-muted)]">
              {t.income.monthlyIncomeLabel}
            </p>
            <p className="font-mono-numbers mt-[6px] text-[27px] font-bold leading-none tracking-[-0.5px] text-[var(--color-brand-green)]">
              {fmtNum(monthlyTotal)}{' '}
              <span className="text-[12px] font-medium text-[var(--color-brand-text-muted)]">{base}</span>
            </p>
            {monthlyUsd ? (
              <p className="font-mono-numbers mt-1 text-[12px] text-[var(--color-brand-text-muted)]">≈ {monthlyUsd}</p>
            ) : null}
          </div>
          <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] bg-[rgba(29,185,84,0.12)] text-[var(--color-brand-green)]">
            <TrendingUp className="h-[22px] w-[22px]" />
          </span>
        </div>
        <div className="my-[13px] h-px bg-[var(--color-brand-border)]" />
        <div className="flex gap-[14px]">
          <div className="flex flex-1 items-center gap-[9px]">
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[rgba(29,185,84,0.13)] text-[var(--color-brand-green)]">
              <RefreshCw className="h-4 w-4" />
            </span>
            <div>
              <p className="font-mono-numbers text-[16px] font-bold leading-none text-[var(--color-brand-text-primary)]">{recurring.length}</p>
              <p className="mt-0.5 text-[10px] text-[var(--color-brand-text-muted)]">{t.income.recurringLabel}</p>
            </div>
          </div>
          <div className="w-px bg-[var(--color-brand-border)]" />
          <div className="flex flex-1 items-center gap-[9px]">
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[rgba(245,200,66,0.13)] text-[var(--color-brand-gold)]">
              <Plus className="h-4 w-4" />
            </span>
            <div>
              <p className="font-mono-numbers text-[16px] font-bold leading-none text-[var(--color-brand-text-primary)]">{oneTimeThisMonth.length}</p>
              <p className="mt-0.5 text-[10px] text-[var(--color-brand-text-muted)]">{t.income.oneTimeLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recurring sources (first) */}
      <p className="mb-[9px] px-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-brand-text-muted)]">
        {t.income.recurringSourcesLabel}
      </p>
      <div className="mb-[18px] flex flex-col gap-[10px]">
        {recurring.map((s) => {
          const colors = incomeTypeColors(s.sourceType)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => { setEditingIncomeId(s.id); setActiveModal('editIncome') }}
              className="flex items-center gap-3 rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-[14px] text-start"
            >
              <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[13px]" style={{ background: colors.bg, color: colors.fg }}>
                <IncomeTypeIcon type={s.sourceType} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-bold text-[var(--color-brand-text-primary)]">{s.name}</p>
                <p className="mt-0.5 truncate text-[11.5px] text-[var(--color-brand-text-muted)]">{freqLabel(s)} · → {accountLabel(s)}</p>
              </div>
              <div className="shrink-0 text-end">
                <p className="font-mono-numbers text-[15px] font-bold text-[var(--color-brand-green)]">+{fmtNum(toBase(s))}</p>
                <p className="mt-px text-[10px] text-[var(--color-brand-text-muted)]">{base} {t.income.perMoSuffix}</p>
              </div>
            </button>
          )
        })}
        {recurring.length === 0 ? (
          <p className="px-1 py-2 text-[12px] text-[var(--color-brand-text-muted)]">{t.income.emptyDesc}</p>
        ) : null}
      </div>

      {/* Income this month */}
      <p className="mb-[9px] px-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-brand-text-muted)]">
        {t.income.incomeThisMonthLabel}
      </p>
      {incomeGroups.map((g) => (
        <div key={g.day}>
          <div className="flex items-center justify-between px-1 pb-[5px] pt-[9px]">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--color-brand-text-muted)]">{g.label}</span>
            <span className="font-mono-numbers text-[10.5px] font-semibold text-[var(--color-brand-green)]">+{fmtNum(g.total)} {base}</span>
          </div>
          <div className="mb-[10px] overflow-hidden rounded-[14px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
            {g.items.map((r, idx) => {
              const colors = incomeTypeColors(r.source.sourceType)
              return (
                <div
                  key={r.id}
                  className={`flex items-center gap-[11px] px-[13px] py-[10px] ${idx === 0 ? '' : 'border-t border-[var(--color-brand-border)]'}`}
                >
                  <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]" style={{ background: colors.bg, color: colors.fg }}>
                    <IncomeTypeIcon type={r.source.sourceType} className="h-[17px] w-[17px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-[6px]">
                      <span className="truncate text-[13.5px] font-semibold text-[var(--color-brand-text-primary)]">{r.name}</span>
                      <span
                        className={`shrink-0 rounded-full px-[7px] py-[2px] text-[9px] font-extrabold uppercase tracking-[0.04em] ${r.recurring ? 'bg-[rgba(29,185,84,0.14)] text-[var(--color-brand-green)]' : 'bg-[rgba(245,200,66,0.14)] text-[var(--color-brand-gold)]'}`}
                      >
                        {r.recurring ? t.income.recurringLabel : t.income.oneTimeLabel}
                      </span>
                    </div>
                    <span className="block truncate text-[11px] text-[var(--color-brand-text-muted)]">→ {accountLabel(r.source)}</span>
                  </div>
                  <span className="font-mono-numbers shrink-0 text-[14px] font-bold text-[var(--color-brand-green)]">+{fmtNum(toBase(r.source))}</span>
                </div>
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
