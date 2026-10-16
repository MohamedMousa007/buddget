'use client'

import { format } from 'date-fns'
import { CircleCheck } from 'lucide-react'
import { FLOW_BAND_BG } from '@/components/features/flow/FlowSummaryBand'
import { Button } from '@/components/ui/button'
import { ProgressRing } from '@/components/ui/ProgressRing'
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
  dueThisMonth: number
  scheduledThisMonth: number
  paidThisMonth: number
  /** Lifetime repaid, shown when nothing is active. */
  paidOff: number
  clearedCount: number
  onOpenCleared: () => void
}

const FG2 = 'text-[var(--flow-band-fg-2)]'
const MIX = 'var(--flow-band-mix)'

interface Cell {
  label: string
  value: string
  sub: string
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
  scheduledThisMonth,
  paidThisMonth,
  paidOff,
  clearedCount,
  onOpenCleared,
}: DebtPortfolioHeroProps) {
  const t = useT().debts
  const money = (n: number) => `${fmtWhole(n)} ${base}`
  const dash = '—'

  const cells: Cell[] =
    activeCount === 0
      ? [
          { label: t.statDebtsCleared, value: clearedCount > 0 ? String(clearedCount) : dash, sub: clearedCount > 0 ? t.heroKeepGoing : t.heroNoDebtsCleared },
          { label: t.statTotalPaidOff, value: paidOff > 0 ? money(paidOff) : dash, sub: paidOff > 0 ? t.heroFirstWin : t.heroNothingPaid },
          { label: t.heroPaidMonth, value: paidThisMonth > 0 ? money(paidThisMonth) : dash, sub: paidThisMonth > 0 ? t.heroKeepGoing : t.heroNothingPaid },
        ]
      : [
          {
            label: t.heroNext,
            value: nextPayment ? money(nextPayment.amount) : dash,
            sub: nextPayment ? `${format(nextPayment.date, 'MMM d')} · ${nextPayment.name}` : t.heroSetPlan,
          },
          {
            label: t.heroDueMonth,
            value: dueThisMonth > 0 ? money(dueThisMonth) : dash,
            sub: dueThisMonth > 0 ? t.heroPaymentsScheduled(scheduledThisMonth) : t.heroNothingDue,
          },
          { label: t.heroPaidMonth, value: paidThisMonth > 0 ? money(paidThisMonth) : dash, sub: paidThisMonth > 0 ? t.heroKeepGoing : t.heroNothingPaid },
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
          <div className="flex shrink-0 flex-col items-end gap-2">
            {borrowedTotal > 0 && activeCount > 0 ? (
              <ProgressRing pct={clearedPct} track={MIX} arc="var(--flow-band-fg)">
                <span className="font-mono-numbers text-[14px] font-bold text-[var(--flow-band-fg)]">{clearedPct}%</span>
              </ProgressRing>
            ) : null}
            {clearedCount > 0 ? (
              <Button variant="onBand" size="touch" className="rounded-full whitespace-nowrap" onClick={onOpenCleared}>
                <CircleCheck aria-hidden />
                {t.heroCompletedPill}
                <span className="font-mono-numbers">{clearedCount}</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <div className="border-t bg-[var(--flow-band-deep)]" style={{ borderColor: MIX }}>
        <div className="mx-auto grid max-w-screen-sm grid-cols-3">
          {cells.map((c, i) => (
            <div key={c.label} className={cn('min-w-0 pb-[11px] pe-2.5 ps-[18px] pt-2.5', i > 0 && 'border-s')} style={i > 0 ? { borderColor: MIX } : undefined}>
              <p className={`truncate text-[10.5px] font-bold uppercase tracking-[0.06em] ${FG2}`}>{c.label}</p>
              <p className="mt-1 truncate whitespace-nowrap font-mono-numbers text-base font-bold">{c.value}</p>
              <p className={`mt-0.5 truncate text-[11px] ${FG2}`}>{c.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
