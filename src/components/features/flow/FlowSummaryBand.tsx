'use client'

import type { ReactNode } from 'react'
import { AlertCircle, Check, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HeroBand, BandScale, BAND_FG2 as FG2, BAND_MIX as MIX } from '@/components/features/hero/HeroBand'
import { fitBigNumber } from '@/components/features/hero/fitText'

export type FlowBandVariant = 'budget' | 'filtered' | 'noBudget' | 'loading'

export interface FlowBandStatus {
  label: string
  icon: 'check' | 'clock' | 'alert'
}

export interface FlowBandStat {
  label: string
  value: string
  /** Money in / out get a small arrow chip beside the label. */
  dir?: 'in' | 'out'
}

export interface FlowSummaryBandProps {
  variant: FlowBandVariant
  /** 11/700 caps, e.g. "Left to spend · September". */
  label: string
  status?: FlowBandStatus
  /** A "Set budget" pill in the status slot, when there is no budget to pace against. */
  setBudget?: { label: string; onPress: () => void }
  /** Pre-formatted figures. */
  big?: string
  of?: string
  side?: string
  sideSub?: string
  /** Fill 0–100 and an optional pace tick 0–100. `ghost` = an empty track (no budget to fill). */
  bar: { pct: number; tick?: number; ghost?: boolean }
  scale: [string, string, string]
  /** The three-cell strip. Omitted (Light touch Flow): no strip, the in/out line rides in `note`. */
  stats?: FlowBandStat[]
  /** One line under the bar (money in and out). */
  note?: ReactNode
  /** A rounded card inside the page gutter instead of the full-bleed band. */
  contained?: boolean
}

const STATUS_ICON = { check: Check, clock: Clock, alert: AlertCircle } as const
/** The chip is inverted (band text colour as its fill); its text carries the tone. */
const STATUS_TONE = { check: 'var(--flow-chip-ok)', clock: 'var(--flow-chip-warn)', alert: 'var(--flow-chip-over)' } as const

/**
 * Flow's teal summary, drawn through {@link HeroBand}: a 22px label row, a 34.5px number row and a 38.75px bar
 * block, then either the 66px stats strip (`stats`) or a one-line `note`. `contained` draws it as a rounded card in
 * the page gutter (Light touch Flow); without it, the full-bleed band. Every state fills the same slots.
 */
export function FlowSummaryBand({ variant, label, status, setBudget, big, of, side, sideSub, bar, scale, stats, note, contained }: FlowSummaryBandProps) {
  const StatusIcon = status ? STATUS_ICON[status.icon] : null
  const loading = variant === 'loading'
  const aside = setBudget ? (
    // A real 44px-tall target; the negative margin keeps the 22px row, the inner span is the visible pill.
    <button
      data-raw-button-ok="a 44px tap box around the band's 26px pill; the inner span is the visible pill"
      type="button"
      onClick={setBudget.onPress}
      className="group/pill -my-[11px] -me-2 flex h-11 shrink-0 items-center px-2 outline-none [touch-action:manipulation]"
    >
      <span className="inline-flex h-[26px] items-center whitespace-nowrap rounded-full border border-[var(--flow-band-mix)] bg-[var(--flow-band-mix)] px-2.5 text-[0.75rem] font-medium text-[var(--flow-band-fg)] transition-colors group-hover/pill:bg-[color-mix(in_oklab,var(--flow-band-fg)_30%,transparent)] group-focus-visible/pill:ring-3 group-focus-visible/pill:ring-ring group-active/pill:translate-y-px">
        {setBudget.label}
      </span>
    </button>
  ) : status && StatusIcon ? (
    <span
      className="inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[var(--flow-band-fg)] px-2 text-[0.71875rem] font-bold"
      style={{ color: STATUS_TONE[status.icon] }}
    >
      <StatusIcon className="size-[13px]" strokeWidth={2.5} aria-hidden />
      {status.label}
    </span>
  ) : null

  return (
    <HeroBand
      label={label}
      aside={aside}
      fitCells
      contained={contained}
      note={loading ? undefined : note}
      cells={stats ? (stats as [FlowBandStat, FlowBandStat, FlowBandStat]) : undefined}
      numbers={loading ? (
        <div className="h-[30px] w-[180px] rounded-lg" style={{ background: MIX }} aria-hidden />
      ) : (
        <>
          <p className="flex min-w-0 items-baseline gap-1.5">
            <span className={cn('min-w-0 shrink font-mono-numbers font-semibold leading-none tracking-[-0.03em]', big ? fitBigNumber(big) : 'text-[32px]')}>{big}</span>
            {of ? <span className={`min-w-0 truncate whitespace-nowrap text-[0.8125rem] ${FG2}`}>{of}</span> : null}
          </p>
          {side ? (
            <p className={`shrink-0 text-end text-[0.71875rem] leading-[1.3] ${FG2}`}>
              <b dir="auto" className="block font-mono-numbers text-[0.9375rem] text-[var(--flow-band-fg)]">{side}</b>
              {sideSub}
            </p>
          ) : null}
        </>
      )}
      bar={loading ? (
        <div className="h-1.5 rounded-full" style={{ background: MIX }} aria-hidden />
      ) : (
        <>
          <div className="relative h-1.5 rounded-full" style={{ background: MIX }}>
            {bar.ghost ? null : (
              <div
                className="h-full rounded-full bg-[var(--flow-band-fg)] transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${Math.max(0, Math.min(100, bar.pct))}%` }}
              />
            )}
            {bar.tick !== undefined ? (
              <span
                className="absolute -bottom-1 -top-1 w-[3px] rounded-[2px] bg-[var(--flow-band-fg)] shadow-[0_0_0_1.5px_var(--flow-band-b)]"
                style={{ insetInlineStart: `${Math.max(0, Math.min(100, bar.tick))}%` }}
                aria-hidden
              />
            ) : null}
          </div>
          <BandScale>
            <span dir="auto" className="shrink-0 whitespace-nowrap">{scale[0]}</span>
            <span dir="auto" className="min-w-0 truncate whitespace-nowrap">{scale[1]}</span>
            <span dir="auto" className="min-w-0 truncate whitespace-nowrap">{scale[2]}</span>
          </BandScale>
        </>
      )}
    />
  )
}
