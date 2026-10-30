'use client'

import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { BAND_FG2, BAND_MIX, BandScale, HeroBand, type HeroBandCell } from '@/components/features/hero/HeroBand'
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
  netWorth: string
  netWorthPrefix?: '≈' | 'At least'
  split: HeroSplitSegment[]
  netWorthTrend?: { points: number[]; pct: string; dir: 'up' | 'down' }
  savingsRate?: number
  badges: ReactNode
}

/** Three tones, all derived from the band so they hold in light and dark. */
const TONES = [
  'var(--flow-band-fg)',
  'var(--color-brand-gold)',
  'color-mix(in oklab, var(--flow-band-fg) 55%, transparent)',
]

/** The Wealth band, same height for every user: total, split bar, net worth with its 30-day trend. */
export function SavingsHero({
  total, currency, totalPrefix, netWorth, netWorthPrefix, split, netWorthTrend, savingsRate, badges,
}: SavingsHeroProps) {
  const t = useT().wealthPage
  const hidden = useMask('hero')
  const prefix = (p?: '≈' | 'At least') => (p === 'At least' ? '≥ ' : p ? `${p} ` : '')
  const cell = (i: number): HeroBandCell => {
    const s = split[i]
    return s ? { label: s.label, value: hidden ? MASK : s.ret ? `${s.value}  ▲${s.ret}` : s.value } : { label: '', value: '' }
  }
  return (
    <HeroBand
      label={t.holdLabel}
      aside={badges}
      numbers={
        <>
          <p className="flex min-w-0 items-baseline gap-1.5">
            {totalPrefix ? <span className={`shrink-0 text-[15px] ${BAND_FG2}`} title={totalPrefix === 'At least' ? t.atLeast : undefined}>{prefix(totalPrefix).trim()}</span> : null}
            <span className="shrink-0 font-mono-numbers text-[32px] font-semibold leading-none tracking-[-0.03em]">{hidden ? MASK : total}</span>
            <span className={`min-w-0 truncate whitespace-nowrap text-[13px] ${BAND_FG2}`}>{currency}</span>
          </p>
          <p className={`shrink-0 text-end text-[11.5px] leading-[1.3] ${BAND_FG2}`}>
            <b className="block font-mono-numbers text-[15px] text-[var(--flow-band-fg)]">{hidden ? MASK : `${prefix(netWorthPrefix)}${netWorth}`}</b>
            {t.netWorth}
            {netWorthTrend ? (
              <span className={`ms-1.5 inline-flex h-[15px] items-center gap-0.5 rounded-full bg-[var(--flow-band-fg)] px-1.5 align-top font-mono-numbers text-[10.5px] font-bold leading-none ${netWorthTrend.dir === 'up' ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]'}`}>
                {netWorthTrend.dir === 'up' ? <ArrowUp className="size-2.5" strokeWidth={3} aria-hidden /> : <ArrowDown className="size-2.5" strokeWidth={3} aria-hidden />}
                {netWorthTrend.pct}
              </span>
            ) : null}
          </p>
        </>
      }
      bar={
        <>
          <div className="flex h-1.5 gap-px overflow-hidden rounded-full" style={{ background: BAND_MIX }}>
            {split.map((s, i) => (
              <span key={s.key} className="h-full" style={{ width: `${Math.max(0, s.pct)}%`, background: TONES[i % TONES.length] }} />
            ))}
          </div>
          <BandScale>
            <span className="flex min-w-0 items-center gap-3">
              {split.map((s, i) => (
                <span key={s.key} className="inline-flex shrink-0 items-center gap-1">
                  <span className="size-2 rounded-[2px]" style={{ background: TONES[i % TONES.length] }} aria-hidden />
                  {Math.round(s.pct)}%
                </span>
              ))}
            </span>
            {savingsRate != null ? <span className="min-w-0 truncate whitespace-nowrap">{t.savesPct(savingsRate)}</span> : null}
          </BandScale>
        </>
      }
      cells={[cell(0), cell(1), cell(2)]}
    />
  )
}
