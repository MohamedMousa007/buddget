'use client'

import { FLOW_BAND_BG } from '@/components/features/flow/FlowSummaryBand'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useT } from '@/lib/i18n'
import { fmtWhole } from './heroCardShared'

export interface DebtPortfolioHeroProps {
  owed: number
  base: string
  secondaryText?: string | null
  clearedPct: number
  borrowedTotal: number
}

/** Debts band: same teal band as Flow and Wealth; the ring shows how much is already cleared. */
export function DebtPortfolioHero({ owed, base, secondaryText, clearedPct, borrowedTotal }: DebtPortfolioHeroProps) {
  const t = useT().debts
  const FG2 = 'text-[var(--flow-band-fg-2)]'
  return (
    <section
      className="border-b border-[var(--flow-band-line)] text-[var(--flow-band-fg)]"
      style={{ background: FLOW_BAND_BG }}
    >
      <div className="mx-auto flex max-w-screen-sm items-center justify-between gap-4 px-[18px] pb-4 pt-3">
        <div className="min-w-0">
          <p className={`text-[11px] font-bold uppercase tracking-[0.08em] ${FG2}`}>{t.heroLabel}</p>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="font-mono-numbers text-[34px] font-semibold leading-none tracking-[-0.03em]">{fmtWhole(owed)}</span>
            <span className={`text-sm font-medium ${FG2}`}>{base}</span>
          </p>
          {secondaryText ? <p className={`mt-1.5 font-mono-numbers text-[13px] ${FG2}`}>≈ {secondaryText}</p> : null}
          <p className={`mt-1.5 text-[12.5px] ${FG2}`}>
            {borrowedTotal > 0 ? t.heroBorrowedTotal(`${fmtWhole(borrowedTotal)} ${base}`) : t.heroDebtFree}
          </p>
        </div>
        {borrowedTotal > 0 ? (
          <ProgressRing pct={clearedPct} track="var(--flow-band-mix)" arc="var(--flow-band-fg)">
            <span className="font-mono-numbers text-[14px] font-bold text-[var(--flow-band-fg)]">{clearedPct}%</span>
          </ProgressRing>
        ) : null}
      </div>
    </section>
  )
}
