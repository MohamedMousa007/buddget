'use client'

import type { ReactNode } from 'react'
import { BAND_FG2, BAND_MIX, BandScale, HeroBand } from '@/components/features/hero/HeroBand'
import { fitBigNumber } from '@/components/features/hero/fitText'
import { MASK } from '@/lib/privacy/mask'
import { useMask } from '@/lib/privacy/useMask'
import { useT } from '@/lib/i18n'

export interface HeroSplitSegment {
  key: string
  label: string
  /** Pre-formatted amount. */
  value: string
  /** Share of the bar, 0–100. */
  pct: number
  /** Return since first purchase, on the market-priced segment. */
  ret?: string
}

export interface SavingsHeroProps {
  /** Pre-formatted total — what you hold. */
  total: string
  currency: string
  totalPrefix?: '≈' | 'At least'
  /** Omit for the v9 Savings band, which shows no net worth beside the total. */
  netWorth?: string
  netWorthPrefix?: '≈' | 'At least'
  split: HeroSplitSegment[]
  netWorthTrend?: { points: number[]; pct: string; dir: 'up' | 'down' }
  /** Optional: the Light touch hero has none (the emergency fund and zakat sit at the end of the page). */
  badges?: ReactNode
  /** Replaces the band label ("What you hold"). */
  label?: string
  /**
   * Final-ui v9 (Flow's height): the legend sits in the scale row under the bar and `note` is the one line under it.
   * Absent = unchanged (bare bar, legend as the note).
   */
  note?: ReactNode
}

/** The band's own ink at falling strengths (`lt.js` wealth split: 1, .6, .35), so it holds in light and dark. */
const TONES = [
  'var(--flow-band-fg)',
  'color-mix(in oklab, var(--flow-band-fg) 60%, transparent)',
  'color-mix(in oklab, var(--flow-band-fg) 35%, transparent)',
  'color-mix(in oklab, var(--flow-band-fg) 20%, transparent)',
]

/**
 * The Wealth hero (Light touch): a rounded card with what you hold, net worth and its trend, the split bar, and one legend
 * line ("Savings 52% · Gold 31%"). No stat cells: the values are in the Holdings list right below.
 */
export function SavingsHero({
  total, currency, totalPrefix, netWorth, netWorthPrefix, split, netWorthTrend, badges, label, note,
}: SavingsHeroProps) {
  const t = useT().wealthPage
  const hidden = useMask('hero')
  const prefix = (p?: '≈' | 'At least') => (p === 'At least' ? '≥ ' : p ? `${p} ` : '')
  const shown = split.filter((s) => s.pct > 0)
  return (
    <HeroBand
      contained
      bareBar={note === undefined}
      label={label ?? t.holdLabel}
      aside={badges}
      numbers={
        <>
          <p className="flex min-w-0 items-baseline gap-1.5">
            {totalPrefix ? <span className={`shrink-0 text-[0.9375rem] ${BAND_FG2}`} title={totalPrefix === 'At least' ? t.atLeast : undefined}>{prefix(totalPrefix).trim()}</span> : null}
            <span className={`shrink-0 font-mono-numbers font-semibold leading-none tracking-[-0.03em] ${hidden ? 'text-[32px]' : fitBigNumber(total)}`}>{hidden ? MASK : total}</span>
            <span className={`min-w-0 truncate whitespace-nowrap text-[0.8125rem] ${BAND_FG2}`}>{currency}</span>
          </p>
          {netWorth === undefined ? null : <p className={`shrink-0 text-end text-[0.71875rem] leading-[1.3] ${BAND_FG2}`}>
            <b className="block font-mono-numbers text-[0.9375rem] text-[var(--flow-band-fg)]">{hidden ? MASK : `${prefix(netWorthPrefix)}${netWorth}`}</b>
            {t.netWorth}
            {netWorthTrend ? <span className="font-mono-numbers"> {netWorthTrend.dir === 'up' ? '▲' : '▼'} {netWorthTrend.pct}</span> : null}
          </p>}
        </>
      }
      bar={
        <>
          <div className="flex h-1.5 gap-[3px]" style={shown.length ? undefined : { background: BAND_MIX, borderRadius: 9999 }}>
            {shown.map((s, i) => (
              <span key={s.key} className="h-full rounded-full" style={{ width: `${s.pct}%`, background: TONES[i % TONES.length] }} />
            ))}
          </div>
          {note !== undefined ? (
            <BandScale>
              <span className="flex min-w-0 gap-3 overflow-hidden">
                {shown.map((s, i) => (
                  <span key={s.key} dir="auto" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                    <span aria-hidden className="size-2 rounded-[2px]" style={{ background: TONES[i % TONES.length] }} />
                    {s.label} {Math.round(s.pct)}%
                  </span>
                ))}
              </span>
            </BandScale>
          ) : null}
        </>
      }
      note={note !== undefined ? note || undefined : shown.length > 0 ? (
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {shown.map((s) => (
            <span key={s.key} dir="auto">{s.label} <b className="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">{Math.round(s.pct)}%</b></span>
          ))}
        </span>
      ) : undefined}
    />
  )
}
