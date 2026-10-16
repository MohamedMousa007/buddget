'use client'

import { format } from 'date-fns'
import { FLOW_BAND_BG } from '@/components/features/flow/FlowSummaryBand'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import { monthProgress } from '@/lib/debts/heroStats'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ScheduledPaymentVM } from '@/hooks/useDebtTabData'
import { fmtWhole } from './heroCardShared'

export interface DebtPortfolioHeroProps {
  owed: number
  base: string
  secondaryText?: string | null
  clearedPct: number
  borrowedTotal: number
  /** Active (not cleared) debts across every family. */
  activeCount: number
  nextPayment: ScheduledPaymentVM | null
  /** Still due this month (scheduled, unpaid). */
  dueThisMonth: number
  paidThisMonth: number
  /** Latest projected final payment across planned non-card debts. */
  debtFreeDate: Date | null
  /** Active non-card debts with no schedule or payoff goal. */
  unplannedCount: number
  lastClearedAt: Date | null
  /** Lifetime repaid, shown when nothing is active. */
  paidOff: number
  clearedCount: number
}

const FG2 = 'text-[var(--flow-band-fg-2)]'
const MIX = 'var(--flow-band-mix)'

interface Cell {
  label: string
  value: string
  sub: string
  /** 0-100 progress bar; null reserves the row without drawing it. */
  bar: number | null
}

/** Debts band: same teal band and stats strip as Flow; the ring shows how much is already cleared. Fixed height in every state. */
export function DebtPortfolioHero({
  owed,
  base,
  secondaryText,
  clearedPct,
  borrowedTotal,
  activeCount,
  nextPayment,
  dueThisMonth,
  debtFreeDate,
  unplannedCount,
  lastClearedAt,
  paidThisMonth,
  paidOff,
  clearedCount,
}: DebtPortfolioHeroProps) {
  const t = useT().debts
  const money = (n: number) => `${fmtWhole(n)} ${base}`
  const dash = '—'

  const compact = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
  const month = monthProgress(paidThisMonth, dueThisMonth)
  const monthCell: Cell =
    dueThisMonth > 0
      ? { label: t.heroMonth, value: `${compact(month.paid)} / ${compact(month.total)}`, sub: t.heroMonthHint, bar: month.pct }
      : { label: t.heroMonth, value: paidThisMonth > 0 ? money(paidThisMonth) : dash, sub: t.heroNothingDue, bar: null }

  const cells: Cell[] =
    activeCount === 0
      ? [
          { label: t.statDebtsCleared, value: clearedCount > 0 ? String(clearedCount) : dash, sub: clearedCount > 0 ? t.heroKeepItUp : t.heroNoDebtsCleared, bar: null },
          { label: t.statTotalPaidOff, value: paidOff > 0 ? money(paidOff) : dash, sub: paidOff > 0 ? t.heroFirstWin : t.heroNothingPaid, bar: null },
          {
            label: t.heroDebtFreeSince,
            value: lastClearedAt ? format(lastClearedAt, 'MMM yyyy') : dash,
            sub: lastClearedAt ? t.heroKeepItUp : t.heroFirstWinLands,
            bar: null,
          },
        ]
      : [
          {
            label: t.heroNext,
            value: nextPayment ? money(nextPayment.amount) : dash,
            sub: nextPayment ? `${format(nextPayment.date, 'MMM d')} · ${nextPayment.name}` : t.heroSetPlan,
            bar: null,
          },
          monthCell,
          {
            label: t.heroDebtFreeBy,
            value: debtFreeDate ? format(debtFreeDate, 'MMM yyyy') : dash,
            sub: !debtFreeDate ? t.heroSetPlan : unplannedCount > 0 ? t.heroWithoutPlan(unplannedCount) : t.heroOnSchedule,
            bar: null,
          },
        ]

  return (
    <section
      className="border-b border-[var(--flow-band-line)] text-[var(--flow-band-fg)]"
      style={{ background: FLOW_BAND_BG }}
    >
      <div className="mx-auto max-w-screen-sm">
        <div className="flex min-h-[148px] items-start justify-between gap-3 px-[18px] pb-3 pt-3">
          <div className="min-w-0">
            <p className={`text-[11px] font-bold uppercase tracking-[0.08em] ${FG2}`}>{t.heroLabel}</p>
            <p className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono-numbers text-[34px] font-semibold leading-none tracking-[-0.03em]">{fmtWhole(owed)}</span>
              <span className={`text-sm font-medium ${FG2}`}>{base}</span>
            </p>
            {secondaryText ? <p className={`mt-1.5 font-mono-numbers text-[13px] ${FG2}`}>≈ {secondaryText}</p> : null}
            <p className={`mt-1.5 text-[12.5px] ${FG2}`}>
              {borrowedTotal > 0 && activeCount > 0 ? t.heroBorrowedTotal(money(borrowedTotal)) : t.heroDebtFree}
            </p>
          </div>
          {borrowedTotal > 0 && activeCount > 0 ? (
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <ProgressRing pct={clearedPct} track={MIX} arc="var(--flow-band-fg)">
                <span className="font-mono-numbers text-[14px] font-bold text-[var(--flow-band-fg)]">{clearedPct}%</span>
              </ProgressRing>
              <div className="text-end">
                <p className="text-[12px] font-semibold">{t.heroClearedPct(clearedPct)}</p>
                <p className={`mt-0.5 font-mono-numbers text-[11px] ${FG2}`}>{t.heroPaidOfTotal(fmtWhole(paidOff), fmtWhole(borrowedTotal))}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="border-t bg-[var(--flow-band-deep)]" style={{ borderColor: MIX }}>
        <div className="mx-auto grid max-w-screen-sm grid-cols-3">
          {cells.map((c, i) => (
            <div key={c.label} className={cn('min-w-0 pb-[11px] pe-2.5 ps-[18px] pt-2.5', i > 0 && 'border-s')} style={i > 0 ? { borderColor: MIX } : undefined}>
              <p className={`truncate text-[10.5px] font-bold uppercase tracking-[0.06em] ${FG2}`}>{c.label}</p>
              <p className="mt-1 truncate whitespace-nowrap font-mono-numbers text-base font-bold">{c.value}</p>
              <p className={`mt-0.5 truncate text-[11px] ${FG2}`}>{c.sub}</p>
              <div className="mt-1 h-[3px]">
                {c.bar != null ? (
                  <Progress value={c.bar}>
                    <ProgressTrack className="h-[3px] bg-[var(--flow-band-mix)]">
                      <ProgressIndicator className="bg-[var(--flow-band-fg)]" />
                    </ProgressTrack>
                  </Progress>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
