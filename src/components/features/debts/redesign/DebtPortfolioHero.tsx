'use client'

import { format } from 'date-fns'
import { BAND_FG2, BAND_MIX, BandScale, HeroBand, type HeroBandCell } from '@/components/features/hero/HeroBand'
import { monthProgress } from '@/lib/debts/heroStats'
import { useT } from '@/lib/i18n'
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

/** Debts band: Flow's band skeleton (fixed height in every state); the bar shows how much is already cleared. */
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
  const monthCell: HeroBandCell =
    dueThisMonth > 0
      ? { label: t.heroMonth, value: `${compact(month.paid)} / ${compact(month.total)}` }
      : { label: t.heroMonth, value: paidThisMonth > 0 ? money(paidThisMonth) : dash }

  const cells: [HeroBandCell, HeroBandCell, HeroBandCell] =
    activeCount === 0
      ? [
          { label: t.statDebtsCleared, value: clearedCount > 0 ? String(clearedCount) : dash },
          { label: t.statTotalPaidOff, value: paidOff > 0 ? money(paidOff) : dash },
          { label: t.heroDebtFreeSince, value: lastClearedAt ? format(lastClearedAt, 'MMM yyyy') : dash },
        ]
      : [
          { label: t.heroNext, value: nextPayment ? money(nextPayment.amount) : dash },
          monthCell,
          { label: t.heroDebtFreeBy, value: debtFreeDate ? format(debtFreeDate, 'MMM yyyy') : dash },
        ]

  const progressing = borrowedTotal > 0 && activeCount > 0
  return (
    <HeroBand
      label={t.heroLabel}
      numbers={
        <>
          <p className="flex min-w-0 items-baseline gap-1.5">
            <span className="shrink-0 font-mono-numbers text-[32px] font-semibold leading-none tracking-[-0.03em]">{fmtWhole(owed)}</span>
            <span className={`min-w-0 truncate whitespace-nowrap text-[13px] ${BAND_FG2}`}>{base}</span>
          </p>
          {progressing ? (
            <p className={`shrink-0 text-end text-[11.5px] leading-[1.3] ${BAND_FG2}`}>
              <b className="block font-mono-numbers text-[15px] text-[var(--flow-band-fg)]">{t.heroClearedPct(clearedPct)}</b>
              {t.heroPaidOfTotal(fmtWhole(paidOff), fmtWhole(borrowedTotal))}
            </p>
          ) : null}
        </>
      }
      bar={
        <>
          <div className="h-1.5 rounded-full" style={{ background: BAND_MIX }}>
            {progressing ? (
              <div className="h-full rounded-full bg-[var(--flow-band-fg)]" style={{ width: `${Math.max(0, Math.min(100, clearedPct))}%` }} />
            ) : null}
          </div>
          <BandScale>
            <span className="min-w-0 truncate whitespace-nowrap">{progressing ? t.heroBorrowedTotal(money(borrowedTotal)) : t.heroDebtFree}</span>
            {secondaryText ? <span className="min-w-0 shrink-0 truncate whitespace-nowrap">≈ {secondaryText}</span> : null}
          </BandScale>
        </>
      }
      cells={cells}
    />
  )
}
