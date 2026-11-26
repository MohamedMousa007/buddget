'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ArrowUpRight, ChevronLeft, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isRealizedOccurrence } from '@/lib/utils/incomeOccurrences'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { IconButton } from '@/components/ui/IconButton'
import { Badge } from '@/components/ui/badge'
import { PaydayTimeline } from '@/components/features/income/PaydayTimeline'
import { PaydayActionsCard } from '@/components/features/income/PaydayActionsCard'
import { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
import { FlowLedger, type FlowLedgerRow } from '@/components/features/flow/FlowLedger'
import { FLOW_BAND_BG } from '@/components/features/hero/HeroBand'
import { paydayMethodLabel } from '@/lib/income/paydayMethod'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { paydayState, recentPaydays } from '@/lib/income/paydaySummary'
import { paydayBadge } from '@/components/features/income/paydayBadge'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency, formatFlex } from '@/lib/utils/formatters'
import { useShortDate } from '@/hooks/useShortDate'
import { useWeekendFirstDay } from '@/hooks/useWeekStart'
import { useT } from '@/lib/i18n'
import type { IncomeSource } from '@/lib/store/types'
import { cadenceLine } from '@/lib/income/cadence'

const TIMELINE_LEN = 6
/** History reaches further back than the timeline: every payday of the last year. */
const HISTORY_LEN = 24

/**
 * Payday detail (screen 15): the full timeline on the teal band, the selected payday's
 * actions under it, and what actually arrived for the earlier ones.
 */
export function PaydayDetail({ source, onBack }: { source: IncomeSource; onBack: () => void }) {
  const shortDate = useShortDate()
  const t = useT()
  const { incomeEvents, paymentMethods, monthStartDay, base, secondary, rates } = useFinanceStore(
    useShallow((s) => ({
      incomeEvents: s.incomeEvents,
      paymentMethods: s.paymentMethods,
      monthStartDay: s.settings.monthStartDay,
      base: s.settings.baseCurrency,
      secondary: s.settings.showSecondaryCurrency ? s.settings.secondaryCurrency : undefined,
      rates: s.exchangeRates,
    })),
  )
  const { monthFilter, setActiveModal, setEditingIncomeId } = useSettingsStore(
    useShallow((s) => ({
      monthFilter: s.monthFilter,
      setActiveModal: s.setActiveModal,
      setEditingIncomeId: s.setEditingIncomeId,
          })),
  )
  const openAmountReceived = useSettingsStore((s) => s.openAmountReceived)
  const lt = useDebtsSubsLtCopy().payday
  const today = useMemo(() => new Date(), [])
  const weekendFirst = useWeekendFirstDay()
  // One rule everywhere (`paydayState`): past its grace with nothing recorded reads as missed, inside it as late.
  const all = useMemo(
    () => recentPaydays(source, incomeEvents, monthFilter, monthStartDay, HISTORY_LEN, today, weekendFirst),
    [source, incomeEvents, monthFilter, monthStartDay, today, weekendFirst],
  )
  const occ = all.slice(-TIMELINE_LEN)
  const toLog = all.find((o) => o.actionable && !isRealizedOccurrence(o))
  // Nothing is selected until a payday is tapped (timeline or history); tapping it again,
  // or anywhere else on the page, clears it — and with it the actions card.
  const [picked, setPicked] = useState<string | null>(null)
  const selected = all.find((o) => o.key === picked)
  const toggle = (key: string) => setPicked((k) => (k === key ? null : key))
  const pm = paydayMethodLabel(source, paymentMethods)
  const typeLabel = incomeSourceTypeLabel(t.income, source.sourceType)
  const monthly = (source.recurringFrequency ?? 'monthly') === 'monthly'

  const bracket = (o: (typeof occ)[number]) => {
    const k = paydayState(o, today).kind
    return k === 'late' ? lt.lateChip : k === 'missed' ? lt.missedChip : ''
  }

  // History: every payday, newest first, whatever its state; the selected one is highlighted.
  const history: FlowLedgerRow[] = [...all]
        .reverse()
        .map((o) => {
          const ev = o.eventId ? incomeEvents.find((e) => e.id === o.eventId) : undefined
          const state = paydayState(o, today)
          const open = !o.eventId
          const missed = state.kind === 'missed'
          // Nothing arrived for an open or missed payday: show what was expected, never as money received.
          const expectedOnly = open || missed
          const amountBase = convertCurrency(expectedOnly ? source.amount : o.amount, expectedOnly ? source.currency : o.currency, base, rates)
          const arrived = shortDate(ev?.receivedDate ?? o.dueDate)
          const badge = paydayBadge(state, t, shortDate(o.dueDate))
          return {
            key: o.key,
            selected: o.key === picked,
            row: {
              icon: <IncomeTypeIcon type={source.sourceType} className="h-5 w-5" />,
              iconBg: 'var(--color-brand-green-soft)',
              iconFg: 'var(--color-brand-green)',
              caption: typeLabel,
              captionColor: 'var(--color-brand-green)',
              onClick: () => toggle(o.key),
              title: t.paydays.paydayTitle(shortDate(o.dueDate)),
              titleBadge: <Badge variant={badge.variant} size="xs" className="shrink-0">{badge.label}</Badge>,
              subtitle: (
                <span className="truncate">
                  {open
                    ? t.paydays.histOpen(`${formatFlex(source.amount)} ${source.currency}`)
                    : missed
                    ? t.paydays.histMarkedMissed(shortDate((ev?.createdAt ?? o.dueDate).slice(0, 10)))
                    : o.status === 'partial'
                      ? t.paydays.histPartial(formatFlex(o.amount), formatFlex(source.amount), arrived)
                      : o.daysLate
                        ? t.paydays.histLate(arrived, o.daysLate)
                        : t.paydays.histOnTime(arrived)}
                </span>
              ),
              amount: expectedOnly ? (
                <>
                  <span className={missed ? 'line-through' : undefined}>{formatFlex(amountBase)}</span> <span className="text-[0.6875rem]">{base}</span>
                </>
              ) : (
                <>
                  +{formatFlex(amountBase)} <span className="text-[0.6875rem] text-[var(--color-brand-text-muted)]">{base}</span>
                </>
              ),
              amountColor: expectedOnly ? 'var(--color-brand-text-muted)' : 'var(--color-brand-green)',
              sub: expectedOnly ? lt.expected : secondary ? `≈ ${formatCurrency(convertCurrency(amountBase, base, secondary, rates), secondary, true)}` : undefined,
            },
          }
        })

  return (
    // A tap anywhere that isn't a payday, the timeline or the actions card clears the selection.
    <div className="min-h-[calc(100dvh-10rem)] pb-6" onClick={() => setPicked(null)}>
      <div className="flex min-h-14 items-center gap-1 pe-2.5 ps-1.5 pt-1">
        <IconButton variant="ghost" size="md" aria-label={t.paydays.backToPaydays} onClick={onBack}>
          <ChevronLeft className="size-5 rtl:rotate-180" strokeWidth={2} />
        </IconButton>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[0.625rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{t.paydays.detailEyebrow}</span>
          <span className="truncate text-xl font-bold tracking-[-0.01em] text-[var(--color-brand-text-primary)]">{source.name}</span>
        </span>
        <IconButton
          variant="ghost"
          size="md"
          aria-label={t.paydays.editAria}
          onClick={() => {
            setEditingIncomeId(source.id)
            setActiveModal('editIncome')
          }}
        >
          <Pencil className="size-[19px]" strokeWidth={1.75} />
        </IconButton>
      </div>

      <section className="mx-4 mt-1.5 overflow-hidden rounded-3xl text-[var(--flow-band-fg)]" style={{ background: FLOW_BAND_BG }}>
        <div className="px-[18px] pb-1.5 pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.08em]">
              {typeLabel} · {cadenceLine(source, t)}
            </span>
            {pm ? <span dir="auto" className="text-xs font-semibold">→ {pm}</span> : null}
          </div>
          <p className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-mono-numbers text-[30px] font-semibold leading-none tracking-[-0.03em]">{formatFlex(source.amount)}</span>
            <span className="text-[0.8125rem]">{monthly ? t.paydays.expectedEachMonth(source.currency) : t.paydays.expectedEachPayday(source.currency)}</span>
          </p>
          <p className="mb-0.5 mt-2.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em]">{t.paydays.lastPaydays(occ.length)}</p>
          <div className="-mx-1.5" onClick={(e) => e.stopPropagation()}>
            <PaydayTimeline
              occurrences={occ}
              dateLabel={(o) => shortDate(o.dueDate)}
              statusBracket={bracket}
              selectedKey={picked}
              onSelect={(o) => toggle(o.key)}
              onBand
            />
          </div>
          <div className="h-3.5" />
        </div>
      </section>

      {/* Light touch `page-paydays`: log the oldest payday still waiting (the Amount received sheet), or edit the payday. */}
      <div className="mx-4 mt-3 grid grid-cols-2 gap-2.5" onClick={(e) => e.stopPropagation()}>
        <Button
          size="touch"
          disabled={!toLog}
          onClick={() => toLog && openAmountReceived(source.id, toLog.key, toLog.dueDate.slice(0, 7))}
          className="rounded-2xl"
        >
          <Plus aria-hidden />
          {lt.logPayday}
        </Button>
        <Button
          variant="secondary"
          size="touch"
          onClick={() => {
            setEditingIncomeId(source.id)
            setActiveModal('editIncome')
          }}
          className="rounded-2xl"
        >
          <ArrowUpRight aria-hidden />
          {lt.editPayday}
        </Button>
      </div>

      {selected ? (
        <div onClick={(e) => e.stopPropagation()}>
          <PaydayActionsCard source={source} occ={selected} />
        </div>
      ) : null}

      {history.length ? (
        <>
          <p className="mx-[18px] mb-1.5 mt-[18px] text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
            {t.paydays.history}
          </p>
          <div onClick={(e) => e.stopPropagation()}>
            <FlowLedger groups={[{ key: 'history', rows: history }]} />
          </div>
        </>
      ) : null}
    </div>
  )
}
