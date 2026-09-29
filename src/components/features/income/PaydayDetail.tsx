'use client'

import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ChevronLeft, Pencil } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { Badge } from '@/components/ui/badge'
import { PaydayTimeline } from '@/components/features/income/PaydayTimeline'
import { PaydayActionsCard } from '@/components/features/income/PaydayActionsCard'
import { IncomeTypeIcon } from '@/components/features/income/IncomeTypeIcon'
import { FlowLedger, type FlowLedgerRow } from '@/components/features/flow/FlowLedger'
import { FLOW_BAND_BG } from '@/components/features/flow/FlowSummaryBand'
import { methodLabel } from '@/components/features/flow/useFlowLedger'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useSettingsStore } from '@/lib/store/useSettingsStore'
import { focusPayday, recentPaydays } from '@/lib/income/paydaySummary'
import { incomeSourceTypeLabel } from '@/lib/i18n/incomeSourceLabels'
import { convertCurrency } from '@/lib/utils/currency'
import { formatCurrency, formatFixed2, formatFlex } from '@/lib/utils/formatters'
import { shortDate } from '@/lib/utils/shortDate'
import { useT } from '@/lib/i18n'
import type { IncomeSource } from '@/lib/store/types'
import { cadenceLine } from '@/lib/income/cadence'

const TIMELINE_LEN = 6

/**
 * Payday detail (screen 15): the full timeline on the teal band, the selected payday's
 * actions under it, and what actually arrived for the earlier ones.
 */
export function PaydayDetail({ source, onBack }: { source: IncomeSource; onBack: () => void }) {
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
  const { monthFilter, setActiveModal, setEditingIncomeId, setEditingIncomeEventId } = useSettingsStore(
    useShallow((s) => ({
      monthFilter: s.monthFilter,
      setActiveModal: s.setActiveModal,
      setEditingIncomeId: s.setEditingIncomeId,
      setEditingIncomeEventId: s.setEditingIncomeEventId,
    })),
  )
  const today = useMemo(() => new Date(), [])
  // An unanswered payday stays "late" until the user says Received or Missed — "missed"
  // on the timeline means someone marked it so.
  const occ = useMemo(
    () =>
      recentPaydays(source, incomeEvents, monthFilter, monthStartDay, TIMELINE_LEN, today).map((o) =>
        !o.eventId && o.status === 'missed' ? { ...o, status: 'late' as const } : o,
      ),
    [source, incomeEvents, monthFilter, monthStartDay, today],
  )
  const [picked, setPicked] = useState<string | null>(null)
  const selected = occ.find((o) => o.key === picked) ?? focusPayday(occ, today)
  const pm = methodLabel(paymentMethods.find((m) => m.id === source.paymentMethodId))
  const typeLabel = incomeSourceTypeLabel(t.income, source.sourceType)
  const monthly = (source.recurringFrequency ?? 'monthly') === 'monthly'

  const bracket = (o: (typeof occ)[number]) =>
    o.status === 'late' ? t.paydays.bracketLate : o.status === 'missed' ? t.paydays.bracketMissed : ''

  // History: every payday on the timeline that has something recorded, newest first.
  const history = useMemo<FlowLedgerRow[]>(
    () =>
      [...occ]
        .reverse()
        .filter((o) => o.eventId && o.key !== selected?.key)
        .map((o) => {
          const ev = incomeEvents.find((e) => e.id === o.eventId)
          const missed = o.status === 'missed'
          const amountBase = convertCurrency(o.amount, o.currency, base, rates)
          const arrived = shortDate(ev?.receivedDate ?? o.dueDate)
          const badge = missed
            ? { v: 'muted' as const, l: t.income.statusMissed }
            : o.status === 'partial'
              ? { v: 'brand' as const, l: t.income.statusPartial }
              : o.daysLate
                ? { v: 'warning' as const, l: t.income.daysLateChip(o.daysLate) }
                : { v: 'positive' as const, l: t.income.statusReceived }
          return {
            key: o.key,
            row: {
              icon: <IncomeTypeIcon type={source.sourceType} className="h-5 w-5" />,
              iconBg: 'var(--color-brand-green-soft)',
              iconFg: 'var(--color-brand-green)',
              caption: typeLabel,
              captionColor: 'var(--color-brand-green)',
              onClick: () => {
                setEditingIncomeEventId(o.eventId!)
                setActiveModal('editIncomeEvent')
              },
              title: t.paydays.paydayTitle(shortDate(o.dueDate)),
              titleBadge: <Badge variant={badge.v} size="xs" className="shrink-0">{badge.l}</Badge>,
              subtitle: (
                <span className="truncate">
                  {missed
                    ? t.paydays.histMarkedMissed(shortDate((ev?.createdAt ?? o.dueDate).slice(0, 10)))
                    : o.status === 'partial'
                      ? t.paydays.histPartial(formatFlex(o.amount), formatFlex(source.amount), arrived)
                      : o.daysLate
                        ? t.paydays.histLate(arrived, o.daysLate)
                        : t.paydays.histOnTime(arrived)}
                </span>
              ),
              amount: (
                <>
                  +{formatFixed2(amountBase)} <span className="text-[11px] text-[var(--color-brand-text-muted)]">{base}</span>
                </>
              ),
              amountColor: missed ? 'var(--color-brand-text-muted)' : 'var(--color-brand-green)',
              sub: secondary ? `≈ ${formatCurrency(convertCurrency(amountBase, base, secondary, rates), secondary, true)}` : undefined,
            },
          }
        }),
    [occ, selected?.key, incomeEvents, source, typeLabel, base, secondary, rates, t, setActiveModal, setEditingIncomeEventId],
  )

  return (
    <div className="pb-6">
      <div className="flex min-h-14 items-center gap-1 pe-2.5 ps-1.5 pt-1">
        <IconButton variant="ghost" size="md" aria-label={t.paydays.backToPaydays} onClick={onBack}>
          <ChevronLeft className="size-5" strokeWidth={2} />
        </IconButton>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{t.paydays.detailEyebrow}</span>
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

      <section className="mt-1.5 border-y border-[var(--flow-band-line)] text-[var(--flow-band-fg)]" style={{ background: FLOW_BAND_BG }}>
        <div className="px-[18px] pb-1.5 pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em]">
              {typeLabel} · {cadenceLine(source, t)}
            </span>
            {pm ? <span className="text-xs font-semibold">→ {pm}</span> : null}
          </div>
          <p className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-mono-numbers text-[30px] font-semibold leading-none tracking-[-0.03em]">{formatFixed2(source.amount)}</span>
            <span className="text-[13px]">{monthly ? t.paydays.expectedEachMonth(source.currency) : t.paydays.expectedEachPayday(source.currency)}</span>
          </p>
          <p className="mb-0.5 mt-2.5 text-[11px] font-bold uppercase tracking-[0.08em]">{t.paydays.lastPaydays(occ.length)}</p>
          <div className="-mx-1.5">
            <PaydayTimeline
              occurrences={occ}
              dateLabel={(o) => shortDate(o.dueDate)}
              statusBracket={bracket}
              selectedKey={selected?.key ?? null}
              onSelect={(o) => setPicked(o.key)}
            />
          </div>
          <div className="h-3.5" />
        </div>
      </section>

      {selected ? <PaydayActionsCard source={source} occ={selected} /> : null}

      {history.length ? (
        <>
          <p className="mx-[18px] mb-1.5 mt-[18px] text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">
            {t.paydays.history}
          </p>
          <FlowLedger groups={[{ key: 'history', rows: history }]} />
        </>
      ) : null}
    </div>
  )
}
