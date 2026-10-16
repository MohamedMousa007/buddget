'use client'

import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { FLOW_BAND_BG } from '@/components/features/flow/FlowSummaryBand'
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

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  const min = Math.min(...points)
  const span = Math.max(...points) - min || 1
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${((i / (points.length - 1)) * 40).toFixed(1)} ${(12 - ((p - min) / span) * 10).toFixed(1)}`)
    .join(' ')
  return (
    <svg width="40" height="14" viewBox="0 0 40 14" aria-hidden className={up ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]'}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** The Wealth band, same height for every user: total, split bar, net worth with its 30-day trend. */
export function SavingsHero({
  total, currency, totalPrefix, netWorth, netWorthPrefix, split, netWorthTrend, savingsRate, badges,
}: SavingsHeroProps) {
  const t = useT().wealthPage
  const prefix = (p?: '≈' | 'At least') => (p === 'At least' ? `${t.atLeast} ` : p ? `${p} ` : '')
  return (
    <section className="border-b border-[var(--flow-band-line)] text-[var(--flow-band-fg)]" style={{ background: FLOW_BAND_BG }}>
      <div className="px-[18px] pb-4 pt-3">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--flow-band-fg-2)]">{t.holdLabel}</span>
          {badges}
        </div>

        <p className="mt-2 flex flex-wrap items-baseline gap-1.5">
          {totalPrefix ? <span className="text-[15px] text-[var(--flow-band-fg-2)]">{prefix(totalPrefix).trim()}</span> : null}
          <span className="font-mono-numbers text-[34px] font-semibold leading-none tracking-[-0.03em]">{total}</span>
          <span className="text-[13px] text-[var(--flow-band-fg-2)]">{currency}</span>
        </p>

        <div className="mt-3 flex h-1.5 gap-px overflow-hidden rounded-full" style={{ background: 'var(--flow-band-mix)' }}>
          {split.map((s, i) => (
            <span key={s.key} className="h-full" style={{ width: `${Math.max(0, s.pct)}%`, background: TONES[i % TONES.length] }} />
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
          {split.map((s, i) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-[var(--flow-band-fg-2)]">
              <span className="size-2.5 rounded-[3px]" style={{ background: TONES[i % TONES.length] }} aria-hidden />
              {s.label}
              <b className="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">{s.value}</b>
              {s.ret ? (
                <span className="inline-flex h-[22px] items-center gap-0.5 rounded-full bg-[var(--flow-band-fg)] px-2 font-mono-numbers text-xs font-bold text-[var(--color-brand-green)]">
                  <ArrowUp className="size-3" strokeWidth={2.5} aria-hidden />{s.ret}
                </span>
              ) : null}
            </span>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-[13px] text-[var(--flow-band-fg-2)]">
          <span className="inline-flex items-center gap-2">
            {t.netWorth}
            <b className="font-mono-numbers font-semibold text-[var(--flow-band-fg)]">{prefix(netWorthPrefix)}{netWorth}</b>
            {netWorthTrend ? (
              <span className={`inline-flex h-[22px] items-center gap-1 rounded-full bg-[var(--flow-band-fg)] px-2 font-mono-numbers text-xs font-bold ${netWorthTrend.dir === 'up' ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]'}`}>
                {netWorthTrend.points.length > 1 ? <Sparkline points={netWorthTrend.points} up={netWorthTrend.dir === 'up'} /> : null}
                {netWorthTrend.dir === 'up' ? <ArrowUp className="size-3" strokeWidth={2.5} aria-hidden /> : <ArrowDown className="size-3" strokeWidth={2.5} aria-hidden />}
                {netWorthTrend.pct}
              </span>
            ) : null}
          </span>
          {savingsRate != null ? <span>{t.savesPct(savingsRate)}</span> : null}
        </div>
      </div>
    </section>
  )
}
