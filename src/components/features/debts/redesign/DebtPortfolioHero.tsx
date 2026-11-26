'use client'

import { fitBigNumber } from '@/components/features/hero/fitText'
import { BAND_FG2, BAND_MIX, BandScale, HeroBand } from '@/components/features/hero/HeroBand'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { monthProgress } from '@/lib/debts/heroStats'
import { useLocale, useT } from '@/lib/i18n'
import { formatLocalized } from '@/lib/i18n/dateFormat'
import { formatCompact } from '@/lib/utils/formatters'
import type { ScheduledPaymentVM } from '@/hooks/useDebtTabData'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { fmtWhole as whole } from './heroCardShared'

export interface DebtPortfolioHeroProps {
  owed: number
  base: string
  secondaryText?: string | null
  clearedPct: number
  borrowedTotal: number
  /** Active (not cleared) debts across every family. */
  activeCount: number
  /** The next payment due today or later. */
  nextPayment: ScheduledPaymentVM | null
  /** Scheduled payments past their date and still unpaid. */
  overdue: { amount: number; since: Date } | null
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
  overdue,
  dueThisMonth,
  debtFreeDate,
  lastClearedAt,
  paidThisMonth,
  paidOff,
  clearedCount,
}: DebtPortfolioHeroProps) {
  const t = useT().debts
  const lt = useDebtsSubsLtCopy().debts.hero
  const { locale } = useLocale()
  const hidden = useMask('hero')
  const fmtWhole = (n: number) => (hidden ? MASK : whole(n))
  const money = (n: number) => (hidden ? MASK : `${whole(n)} ${base}`)
  const dash = '—'

  const compact = (n: number) => (hidden ? MASK : formatCompact(n, locale))
  const month = monthProgress(paidThisMonth, dueThisMonth)

  // Light touch: the three cells collapse into one line under the bar.
  const parts: React.ReactNode[] =
    activeCount === 0
      ? [clearedCount > 0 ? lt.cleared(clearedCount, money(paidOff)) : '', lastClearedAt ? `${t.heroDebtFreeSince} ${formatLocalized(lastClearedAt, 'MMM yyyy', locale)}` : '']
      : [
          overdue ? lt.overdue(fmtWhole(overdue.amount), formatLocalized(overdue.since, 'MMM d', locale)) : '',
          nextPayment ? lt.next(fmtWhole(nextPayment.amount), formatLocalized(nextPayment.date, 'MMM d', locale)) : '',
          dueThisMonth > 0 ? lt.month(compact(month.paid), compact(month.total)) : paidThisMonth > 0 ? `${t.heroMonth} ${money(paidThisMonth)}` : '',
          debtFreeDate ? lt.freeBy(formatLocalized(debtFreeDate, 'MMM yyyy', locale)) : '',
        ]
  const shown = parts.filter(Boolean)
  const note = shown.length ? <span dir="auto"><b className="font-semibold text-[var(--flow-band-fg)]">{shown[0]}</b>{shown.slice(1).map((p, i) => <span key={i}> · {p}</span>)}</span> : dash

  const progressing = borrowedTotal > 0 && activeCount > 0
  return (
    <HeroBand
      label={t.heroLabel}
      numbers={
        <>
          <p className="flex min-w-0 items-baseline gap-1.5">
            <span className={`shrink-0 font-mono-numbers font-semibold leading-none tracking-[-0.03em] ${fitBigNumber(fmtWhole(owed))}`}>{fmtWhole(owed)}</span>
            <span className={`min-w-0 truncate whitespace-nowrap text-[0.8125rem] ${BAND_FG2}`}>{base}</span>
          </p>
          {progressing ? (
            <p className={`shrink-0 text-end text-[0.71875rem] leading-[1.3] ${BAND_FG2}`}>
              <b dir="auto" className="block font-mono-numbers text-[0.9375rem] text-[var(--flow-band-fg)]">{t.heroClearedPct(clearedPct)}</b>
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
            <span dir="auto" className="min-w-0 truncate whitespace-nowrap">{progressing ? t.heroBorrowedTotal(money(borrowedTotal)) : t.heroDebtFree}</span>
            {secondaryText ? <span dir="auto" className="min-w-0 shrink-0 truncate whitespace-nowrap">≈ {hidden ? MASK : secondaryText}</span> : null}
          </BandScale>
        </>
      }
      note={note}
      contained
    />
  )
}
