'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { MonthNavigationControl } from '@/components/layout/MonthNavigationControl'
import { RecurringIncomeCard } from '@/components/features/income/RecurringIncomeCard'
import { RecurringIncomeCarousel } from '@/components/features/income/RecurringIncomeCarousel'
import { IncomeLedgerRow } from '@/components/features/income/IncomeLedgerRow'
import { IncomeTypeIcon, incomeTypeColors } from '@/components/features/income/IncomeTypeIcon'
import { GLASS_CARD, GLASS_GREEN_BTN } from '@/components/features/income/incomeGlass'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { useT } from '@/lib/i18n'
import { useHydrateIncome, useHydrateIncomeEvents, useHydrateDebts, useHydrateSavings } from '@/hooks/remote'
import { SkeletonList } from '@/components/ui/SkeletonList'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency } from '@/lib/utils/formatters'
import { getMonthRange, recurringActiveForWindow } from '@/lib/utils/calculations'
import { buildOccurrences, monthlyEquivalent } from '@/lib/utils/incomeOccurrences'
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
    const cad =
      freq === 'weekly' ? t.addIncome.freqWeekly : freq === 'biweekly' ? t.addIncome.freqBiweekly : `${t.addIncome.freqMonthly} · day ${s.dayOfMonth ?? 1}`
    return `${cad} · ${accountLabel(s)}`
  }

  // Recurring sources active for the selected month.
  const recurring = useMemo(() => {
    const { start, end } = getMonthRange(monthFilter, settings.monthStartDay)
    return incomeSources.filter((s) => s.isRecurring && recurringActiveForWindow(s, start, end))
  }, [incomeSources, monthFilter, settings.monthStartDay])

  // Per-source occurrences + base-currency progress figures.
  const cards = useMemo(() => {
    return recurring.map((s) => {
      const occ = buildOccurrences(s, incomeEvents, monthFilter, settings.monthStartDay)
      const expectedBase = convertCurrency(monthlyEquivalent(s), s.currency, base, exchangeRates)
      const realizedBase = occ.reduce(
        (sum, o) => (o.status !== 'awaiting' && o.status !== 'missed' ? sum + convertCurrency(o.amount, o.currency, base, exchangeRates) : sum),
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
      {/* Header: month switcher */}
      <div className="mb-3.5">
        <MonthNavigationControl monthFilter={monthFilter} onChange={setMonthFilter} compact />
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
                  {t.income.receivedOfExpected(`${fmtNum(realizedBase)} ${base}`, `${fmtNum(expectedBase)} ${base}`)}
                  {' · '}
                  {remaining <= 0 ? <span className="text-[#35D46F]">{t.income.fullyReceived}</span> : t.income.toCome(`${fmtNum(remaining)} ${base}`)}
                </>
              )
              return (
                <RecurringIncomeCard
                  sourceType={source.sourceType}
                  name={source.name}
                  cadenceLine={cadenceLine(source)}
                  expectedBig={fmtNum(expectedBase)}
                  expectedCurrency={base}
                  expectedSecondary={secondaryOf(expectedBase)}
                  progressPct={expectedBase > 0 ? (realizedBase / expectedBase) * 100 : 0}
                  progressLine={progressLine}
                  occurrences={occ}
                  chipLabel={(o) => fmtDay(o.date)}
                  selectedKey={selected?.sourceId === source.id ? selected.occKey : null}
                  onChipTap={(o) =>
                    setSelected((prev) => (prev?.sourceId === source.id && prev.occKey === o.key ? null : { sourceId: source.id, occKey: o.key }))
                  }
                  footer={
                    sel ? (
                      <button
                        type="button"
                        onClick={() => openAmountReceived(source.id, sel.key)}
                        className="w-full py-2.5 text-sm font-bold"
                        style={GLASS_GREEN_BTN}
                      >
                        {sel.status === 'awaiting' ? t.income.markDateReceived(fmtDay(sel.date)) : t.income.editDateAmount(fmtDay(sel.date))}
                      </button>
                    ) : (
                      <p className="text-center text-[11px] text-white/45">{t.income.tapPaydayTip}</p>
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
          <div className="flex items-center justify-between px-1 pb-1.5 pt-2.5">
            <span className="text-xs font-bold uppercase tracking-[0.05em] text-[var(--color-brand-text-muted)]">{g.label}</span>
            <span className="font-mono-numbers text-xs font-semibold text-[var(--color-brand-text-muted)]">+{fmtNum(g.total)} {base}</span>
          </div>
          <div className="mb-2.5 overflow-hidden rounded-lg border border-[var(--color-brand-border)]">
            {g.items.map((r, idx) => {
              const colors = incomeTypeColors(r.sourceType)
              const clickable = Boolean(r.eventId || r.sourceId)
              const open = r.eventId
                ? () => { setEditingIncomeEventId(r.eventId!); setActiveModal('editIncomeEvent') }
                : r.sourceId
                  ? () => { setEditingIncomeId(r.sourceId!); setActiveModal('editIncome') }
                  : undefined
              return (
                <IncomeLedgerRow
                  key={r.id}
                  onDelete={() => handleDelete(r)}
                  canAssign={r.canAssign}
                  onAssign={() => r.eventId && openAssignIncome({ eventId: r.eventId })}
                  deleteLabel={t.income.swipeDelete}
                  assignLabel={t.income.swipeAssign}
                >
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={open}
                    className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-start ${idx === 0 ? '' : 'border-t border-[var(--color-brand-border)]'} ${clickable ? 'hover:bg-[var(--color-brand-elevated)]' : 'cursor-default'}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ background: colors.bg, color: colors.fg }}>
                      <IncomeTypeIcon type={r.sourceType} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{r.name}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.04em] ${r.recurring ? 'bg-[rgba(29,185,84,0.16)] text-[var(--color-brand-green)]' : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-muted)]'}`}
                        >
                          {r.recurring ? t.income.recurringLabel : t.income.oneTimeLabel}
                        </span>
                      </div>
                      <span className="block truncate text-xs text-[var(--color-brand-text-muted)]">→ {accountLabel(r.acct)}</span>
                    </div>
                    <span className="font-mono-numbers shrink-0 text-sm font-bold text-[var(--color-brand-text-primary)]">+{fmtNum(r.amountBase)} <span className="text-[10px] font-medium text-[var(--color-brand-text-muted)]">{base}</span></span>
                  </button>
                </IncomeLedgerRow>
              )
            })}
          </div>
        </div>
      ))}
      {ledgerCount === 0 ? <p className="px-1 py-6 text-center text-sm text-[var(--color-brand-text-muted)]">{t.income.emptyTitle}</p> : null}
    </div>
  )
}
