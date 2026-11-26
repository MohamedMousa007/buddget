'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { format, isWithinInterval, parseISO } from 'date-fns'
import { ArrowLeftRight, CalendarClock, CreditCard, Landmark, Plus, Smartphone } from 'lucide-react'
import { SwipeToDelete, type SwipeSide } from '@/components/expenses/SwipeToDelete'
import { DateRangeField, Divider, FilterSheet, SectionHead } from '@/components/expenses/ExpenseFilters'
import { FlowChipRow, type FlowChip } from '@/components/features/flow/FlowChipRow'
import { TransactionRow } from '@/components/transactions/TransactionRow'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { OptionChip } from '@/components/ui/OptionChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useLinkedDelete } from '@/hooks/useLinkedDelete'
import { useWeekStart } from '@/hooks/useWeekStart'
import type { PaymentVM } from '@/hooks/useDebtTabData'
import { debtFamily, DEBT_FAMILY_ORDER, type DebtFamily } from '@/lib/debts/debtFamily'
import { resolveRange, type RangePreset } from '@/lib/expenses/dateRange'
import { countedDebtPayments, countedDebts } from '@/lib/spending/exclusion'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { formatWhole } from '@/lib/utils/formatters'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'

const FAMILY: Record<DebtFamily, { Icon: typeof Landmark; tone: string }> = {
  borrow: { Icon: Landmark, tone: 'var(--color-brand-amber)' },
  installment: { Icon: Smartphone, tone: 'var(--color-brand-primary)' },
  credit_card: { Icon: CreditCard, tone: 'var(--color-brand-green)' },
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

/**
 * Payments toward every debt and the debts added, newest first, as Flow rows, with Flow's filter chips (paid or added,
 * family, one debt, a date range). Swipe a payment left to delete it: the paired expense goes with it, what is owed goes
 * back up, and Undo restores both (`deleteDebtPayment` / `restoreDebtPayment` via useLinkedDelete).
 */
export function DebtPaymentsFeed({ payments }: { payments: PaymentVM[] }) {
  const t = useT()
  const c = useDebtsSubsLtCopy().debts
  const td = t.debts
  const tm = t.debtMoves
  const { locale } = useLocale()
  const familyLabel: Record<DebtFamily, string> = { borrow: td.feedBorrow, credit_card: td.feedCard, installment: td.feedPlan }
  const { debts, debtPayments, monthStartDay } = useFinanceStore(
    useShallow((s) => ({
      debts: countedDebts(s.debts, s.paymentMethods),
      debtPayments: countedDebtPayments(s.debtPayments, s.debts, s.paymentMethods),
      monthStartDay: s.settings.monthStartDay,
    })),
  )
  const monthFilter = useSettingsStore((s) => s.monthFilter)
  const weekStart = useWeekStart()
  const { removeDebtPayment } = useLinkedDelete()
  const [filters, setFilters] = useState<MoveFilters>(NO_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [openRow, setOpenRow] = useState<{ id: string; side: SwipeSide } | null>(null)

  const moves = useMemo<Move[]>(() => {
    const debtOf = new Map(debtPayments.map((p) => [p.id, p.debtId]))
    const paid: Move[] = payments.map((p) => ({ id: p.id, kind: 'paid', family: p.family, debtId: debtOf.get(p.id) ?? '', name: p.name, method: p.method, amount: p.amount, date: p.date }))
    const added: Move[] = debts.map((d) => ({ id: `added-${d.id}`, kind: 'added', family: debtFamily(d), debtId: d.id, name: d.name || d.person, amount: d.startingBalance, date: d.createdAt }))
    return [...paid, ...added].sort((a, b) => b.date.localeCompare(a.date))
  }, [payments, debts, debtPayments])

  const shown = useMemo(() => {
    const bounds = filters.range === 'any'
      ? null
      : resolveRange({ preset: filters.range, from: filters.from || null, to: filters.to || null }, monthFilter, monthStartDay, new Date(), weekStart)
    return moves.filter(
      (m) =>
        (filters.kind === 'all' || m.kind === filters.kind) &&
        (!filters.family || m.family === filters.family) &&
        (!filters.debtId || m.debtId === filters.debtId) &&
        (!bounds || isWithinInterval(parseISO(m.date.slice(0, 10)), bounds)),
    )
  }, [moves, filters, monthFilter, monthStartDay, weekStart])

  if (moves.length === 0) return null

  const patch = (p: Partial<MoveFilters>) => setFilters((f) => ({ ...f, ...p }))
  const rangeLabel: Partial<Record<RangeKey, string>> = { any: tm.anyTime, all: tm.anyTime, today: t.common.today, yesterday: t.common.yesterday, week: tm.thisWeek, month: tm.thisMonth, custom: tm.custom }
  const debtName = (id: string) => debts.find((d) => d.id === id)?.name ?? ''
  const chips = [
    filters.kind !== 'all' && { key: 'kind', label: filters.kind === 'paid' ? tm.movePaid : tm.moveAdded, selected: true, onPress: () => patch({ kind: 'all' }) },
    filters.family && { key: 'family', label: familyLabel[filters.family], selected: true, onPress: () => patch({ family: null, debtId: null }) },
    filters.debtId && { key: 'debt', label: debtName(filters.debtId), selected: true, onPress: () => patch({ debtId: null }) },
    filters.range !== 'any' && { key: 'range', label: rangeLabel[filters.range] ?? tm.custom, selected: true, onPress: () => patch({ range: 'any', from: '', to: '' }) },
  ].filter(Boolean) as FlowChip[]
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const familyDebts = debts.filter((d) => !filters.family || debtFamily(d) === filters.family)
  const day = (iso: string) => parseISO(iso.slice(0, 10))

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className={microClassName}>{c.payments}</h2>
        <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{c.swipeHint}</span>
      </div>
      <div className="-mx-4 lg:mx-0">
        <FlowChipRow filterCount={chips.length} onOpenFilters={() => setSheetOpen(true)} chips={chips} />
      </div>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--color-brand-text-secondary)]">{tm.noMatch}</p>
      ) : (
        <Card padding="none" divide className="mt-2 overflow-hidden">
          {shown.map((m) => {
            const { Icon, tone } = FAMILY[m.family]
            const row = (
              <TransactionRow
                icon={m.kind === 'added' ? <Plus className="size-5" /> : <Icon className="size-5" />}
                iconBg={`color-mix(in oklab, ${tone} 14%, transparent)`}
                iconFg={tone}
                title={m.kind === 'added' ? m.name : c.paymentTitle(m.name, formatLocalized(day(m.date), 'MMMM', locale))}
                subtitle={m.kind === 'added'
                  ? `${tm.added} · ${familyLabel[m.family]} · ${formatLocalized(day(m.date), 'MMM d', locale)}`
                  : [formatLocalized(day(m.date), 'MMM d', locale), m.method].filter(Boolean).join(' · ')}
                amount={m.kind === 'paid' ? `−${formatWhole(m.amount)}` : m.amount > 0 ? formatWhole(m.amount) : '—'}
                amountColor={m.kind === 'added' ? 'var(--color-brand-text-secondary)' : undefined}
              />
            )
            return m.kind === 'paid' ? (
              <SwipeToDelete
                key={m.id}
                openSide={openRow?.id === m.id ? openRow.side : null}
                onOpenChange={(side) => setOpenRow(side ? { id: m.id, side } : null)}
                onDelete={() => {
                  setOpenRow(null)
                  void removeDebtPayment(m.id)
                }}
                deleteLabel={t.common.delete}
              >
                {row}
              </SwipeToDelete>
            ) : (
              <div key={m.id}>{row}</div>
            )
          })}
        </Card>
      )}

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        footer={<Button size="cta-block" onClick={() => setSheetOpen(false)}>{t.expenses.showResults.replace('{count}', String(shown.length))}</Button>}
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-[var(--color-brand-text-primary)]">{t.expenses.filtersTitle}</h3>
            <Button variant="link" size="touch" onClick={() => setFilters(NO_FILTERS)}>{t.expenses.resetAll}</Button>
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
            <SectionHead icon={Landmark} label={tm.debtType} />
            <SegmentedControl
              ariaLabel={tm.debtType}
              value={filters.family ?? 'all'}
              onChange={(v) => patch({ family: v === 'all' ? null : v, debtId: null })}
              options={[{ value: 'all', label: tm.moveAll }, ...DEBT_FAMILY_ORDER.map((f) => ({ value: f, label: familyLabel[f] }))]}
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
    </section>
  )
}
