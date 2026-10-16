'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format, isWithinInterval, parseISO } from 'date-fns'
import { ArrowLeftRight, CalendarClock, Check, CircleCheck, CreditCard as CardIcon, Landmark, Layers, HandCoins, Plus } from 'lucide-react'
import { SwipeToDelete, type SwipeSide } from '@/components/expenses/SwipeToDelete'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { FlowChipRow, type FlowChip } from '@/components/features/flow/FlowChipRow'
import { DateRangeField, Divider, FilterSheet, SectionHead } from '@/components/expenses/ExpenseFilters'
import { useActionToast } from '@/components/ui/ActionToast'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { FAMILY_ACCENT, type PaymentVM } from '@/hooks/useDebtTabData'
import { debtFamily, DEBT_FAMILY_ORDER, type DebtFamily } from '@/lib/debts/debtFamily'
import { resolveRange, type RangePreset } from '@/lib/expenses/dateRange'
import { useT } from '@/lib/i18n'
import { fmtWhole, soft } from './heroCardShared'

const FAMILY_ICON: Record<DebtFamily, typeof Check> = {
  borrow: HandCoins,
  credit_card: CardIcon,
  installment: Layers,
}

type MoveKind = 'paid' | 'added'
type RangeKey = RangePreset | 'any'

interface Move {
  id: string
  kind: MoveKind
  family: DebtFamily
  debtId: string
  name: string
  method?: string
  amount: number
  date: string
}

interface MoveFilters {
  kind: 'all' | MoveKind
  family: DebtFamily | null
  debtId: string | null
  range: RangeKey
  from: string
  to: string
}

const NO_FILTERS: MoveFilters = { kind: 'all', family: null, debtId: null, range: 'any', from: '', to: '' }

/** Recent moves across every debt: payments and new debts, day-grouped, filterable like Flow. */
export function DebtPaymentsFeed({
  payments,
  completedCount = 0,
  onOpenCompleted,
}: {
  payments: PaymentVM[]
  currentFamily?: DebtFamily
  /** Cleared debts; shows the Completed debts pill beside the title when > 0. */
  completedCount?: number
  onOpenCompleted?: () => void
}) {
  const t = useT()
  const td = t.debts
  const tm = t.debtMoves
  const familyLabel: Record<DebtFamily, string> = { borrow: td.feedBorrow, credit_card: td.feedCard, installment: td.feedPlan }
  const { debts, debtPayments, monthStartDay, deleteDebtPayment } = useFinanceStore(
    useShallow((s) => ({
      debts: s.debts,
      debtPayments: s.debtPayments,
      monthStartDay: s.settings.monthStartDay,
      deleteDebtPayment: s.deleteDebtPayment,
    })),
  )
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const toast = useActionToast()
  const [filters, setFilters] = useState<MoveFilters>(NO_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [openRow, setOpenRow] = useState<{ id: string; side: SwipeSide } | null>(null)

  const moves = useMemo<Move[]>(() => {
    const debtOf = new Map(debtPayments.map((p) => [p.id, p.debtId]))
    const paid: Move[] = payments.map((p) => ({
      id: p.id, kind: 'paid', family: p.family, debtId: debtOf.get(p.id) ?? '', name: p.name, method: p.method, amount: p.amount, date: p.date,
    }))
    const added: Move[] = debts.map((d) => ({
      id: `added-${d.id}`, kind: 'added', family: debtFamily(d), debtId: d.id, name: d.name || d.person, amount: d.startingBalance, date: d.createdAt,
    }))
    return [...paid, ...added].sort((a, b) => b.date.localeCompare(a.date))
  }, [payments, debts, debtPayments])

  const shown = useMemo(() => {
    const bounds =
      filters.range === 'any'
        ? null
        : resolveRange({ preset: filters.range, from: filters.from || null, to: filters.to || null }, monthFilter, monthStartDay)
    return moves.filter(
      (m) =>
        (filters.kind === 'all' || m.kind === filters.kind) &&
        (!filters.family || m.family === filters.family) &&
        (!filters.debtId || m.debtId === filters.debtId) &&
        (!bounds || isWithinInterval(parseISO(m.date.slice(0, 10)), bounds)),
    )
  }, [moves, filters, monthFilter, monthStartDay])

  const groups = useMemo(() => {
    const map = new Map<string, Move[]>()
    for (const m of shown) {
      const key = m.date.slice(0, 10)
      map.set(key, [...(map.get(key) ?? []), m])
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: format(parseISO(key), 'MMM d'),
      total: items.reduce((s, x) => s + (x.kind === 'paid' ? -x.amount : 0), 0),
      items,
    }))
  }, [shown])

  if (moves.length === 0) return null

  const patch = (p: Partial<MoveFilters>) => setFilters((f) => ({ ...f, ...p }))
  const rangeLabel: Record<RangeKey, string> = { any: tm.anyTime, today: t.common.today, yesterday: t.common.yesterday, week: tm.thisWeek, month: tm.thisMonth, custom: tm.custom }
  const debtName = (id: string) => debts.find((d) => d.id === id)?.name ?? ''
  const chips: FlowChip[] = [
    filters.kind !== 'all' && { key: 'kind', label: filters.kind === 'paid' ? tm.movePaid : tm.moveAdded, selected: true, onPress: () => patch({ kind: 'all' }) },
    filters.family && { key: 'family', label: familyLabel[filters.family], selected: true, onPress: () => patch({ family: null, debtId: null }) },
    filters.debtId && { key: 'debt', label: debtName(filters.debtId), selected: true, onPress: () => patch({ debtId: null }) },
    filters.range !== 'any' && { key: 'range', label: rangeLabel[filters.range], selected: true, onPress: () => patch({ range: 'any', from: '', to: '' }) },
  ].filter(Boolean) as FlowChip[]
  const filterCount = chips.length

  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const familyDebts = debts.filter((d) => !filters.family || debtFamily(d) === filters.family)

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-2 px-[18px]">
        <h2 className="text-[17px] font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">{tm.title}</h2>
        {completedCount > 0 && onOpenCompleted ? (
          <Button variant="outline" size="touch" className="rounded-full border-[var(--color-brand-green)]/40 bg-[var(--color-brand-green-soft)] text-[var(--color-brand-green)]" onClick={onOpenCompleted}>
            <CircleCheck aria-hidden />
            {t.debts.heroCompletedPill}
            <span className="font-mono-numbers">{completedCount}</span>
          </Button>
        ) : null}
      </div>
      <FlowChipRow filterCount={filterCount} onOpenFilters={() => setSheetOpen(true)} chips={chips} />

      <div className="mt-3">
        {groups.length === 0 ? (
          <p className="px-[18px] py-8 text-center text-sm text-[var(--color-brand-text-secondary)]">{tm.noMatch}</p>
        ) : null}
        {groups.map((g, gi) => (
          <div key={g.key}>
            <div className={`flex items-baseline justify-between px-[18px] pb-2 ${gi === 0 ? 'pt-1' : 'pt-5'}`}>
              <span className="text-[15px] font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">{g.label}</span>
              {g.total !== 0 ? (
                <span className="font-mono-numbers text-[11px] font-medium tabular-nums text-[var(--color-brand-text-muted)]">−{fmtWhole(-g.total)}</span>
              ) : null}
            </div>
            <div className="border-y border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
              {g.items.map((m, i) => {
                const FamilyIcon = m.kind === 'added' ? Plus : FAMILY_ICON[m.family]
                const accent = FAMILY_ACCENT[m.family]
                const row = (
                  <TransactionRow
                    icon={<FamilyIcon className="h-5 w-5" />}
                    iconBg={soft(accent, 16)}
                    iconFg={accent}
                    caption={m.kind === 'added' ? tm.added : familyLabel[m.family]}
                    captionColor={accent}
                    title={m.name}
                    subtitle={m.kind === 'added' ? familyLabel[m.family] : `${format(parseISO(m.date), 'MMM d')}${m.method ? ` · ${m.method}` : ''}`}
                    amount={m.kind === 'paid' ? `−${fmtWhole(m.amount)}` : m.amount > 0 ? `+${fmtWhole(m.amount)}` : '—'}
                    sub={
                      m.kind === 'paid' ? (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--color-brand-green)]">
                          <Check className="h-3 w-3" strokeWidth={3} /> {tm.paidTag}
                        </span>
                      ) : undefined
                    }
                  />
                )
                return (
                  <div key={m.id}>
                    {i > 0 ? <div className="ms-[82px] h-px bg-[var(--color-brand-border)]" /> : null}
                    {m.kind === 'paid' ? (
                      <SwipeToDelete
                        openSide={openRow?.id === m.id ? openRow.side : null}
                        onOpenChange={(side) => setOpenRow(side ? { id: m.id, side } : null)}
                        onDelete={() => {
                          setOpenRow(null)
                          deleteDebtPayment(m.id)
                          toast(td.feedDeleted)
                        }}
                        deleteLabel={t.common.delete}
                      >
                        {row}
                      </SwipeToDelete>
                    ) : (
                      row
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        footer={
          <Button size="cta-block" onClick={() => setSheetOpen(false)}>
            {t.expenses.showResults.replace('{count}', String(shown.length))}
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{t.expenses.filtersTitle}</h3>
            <Button variant="link" size="touch" onClick={() => setFilters(NO_FILTERS)}>
              {t.expenses.resetAll}
            </Button>
          </div>

          <div className="flex flex-col gap-2.5">
            <SectionHead icon={CalendarClock} label={tm.dateRange} />
            <DateRangeField
              preset={filters.range}
              from={filters.from || todayIso}
              to={filters.to || todayIso}
              anyLabel={tm.anyTime}
              onPreset={(range) => patch({ range, ...(range === 'custom' ? { from: filters.from || todayIso, to: filters.to || todayIso } : {}) })}
              onRange={(from, to) => patch({ from, to })}
            />
          </div>
          <Divider />

          <div className="flex flex-col gap-2.5">
            <SectionHead icon={ArrowLeftRight} label={tm.moveType} />
            <SegmentedControl
              ariaLabel={tm.moveType}
              value={filters.kind}
              onChange={(kind) => patch({ kind })}
              options={[
                { value: 'all', label: tm.moveAll },
                { value: 'paid', label: tm.movePaid },
                { value: 'added', label: tm.moveAdded },
              ]}
            />
          </div>
          <Divider />

          <div className="flex flex-col gap-2.5">
            <SectionHead icon={Layers} label={tm.debtType} />
            <SegmentedControl
              ariaLabel={tm.debtType}
              value={filters.family ?? 'all'}
              onChange={(v) => patch({ family: v === 'all' ? null : v, debtId: null })}
              options={[
                { value: 'all', label: tm.moveAll },
                ...DEBT_FAMILY_ORDER.map((f) => ({ value: f, label: familyLabel[f] })),
              ]}
            />
          </div>

          {familyDebts.length > 1 ? (
            <>
              <Divider />
              <div className="flex flex-col gap-2.5">
                <SectionHead icon={Landmark} label={tm.debt} />
                <div className="flex flex-wrap gap-2">
                  {familyDebts.map((d) => (
                    <OptionChip key={d.id} selected={filters.debtId === d.id} onClick={() => patch({ debtId: filters.debtId === d.id ? null : d.id })}>
                      {d.name || d.person}
                    </OptionChip>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </FilterSheet>
    </div>
  )
}
