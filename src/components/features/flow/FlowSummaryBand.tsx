'use client'

import { AlertCircle, Check, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  stats: FlowBandStat[]
}

const STATUS_ICON = { check: Check, clock: Clock, alert: AlertCircle } as const
/** The chip is inverted (band text colour as its fill); its text carries the tone. */
const STATUS_TONE = { check: 'var(--flow-chip-ok)', clock: 'var(--flow-chip-warn)', alert: 'var(--flow-chip-over)' } as const

/**
 * Flow's full-bleed teal summary, drawn through {@link HeroBand}. Its height never changes: a 22px
 * label row, a 34.5px number row, a 38.75px bar block and a 66px stats strip. Every state, filter
 * and segment fills the same slots, so only values move.
 */
export function FlowSummaryBand({ variant, label, status, setBudget, big, of, side, sideSub, bar, scale, stats }: FlowSummaryBandProps) {
  const StatusIcon = status ? STATUS_ICON[status.icon] : null
  const loading = variant === 'loading'
  const aside = setBudget ? (
    <Button
      variant="onBand"
      onClick={setBudget.onPress}
      className='relative h-[26px] shrink-0 rounded-full px-2.5 text-[0.75rem] after:absolute after:left-1/2 after:top-1/2 after:min-h-[44px] after:min-w-[44px] after:-translate-x-1/2 after:-translate-y-1/2 after:content-[""]'
    >
      {setBudget.label}
    </Button>
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
      cells={stats as [FlowBandStat, FlowBandStat, FlowBandStat]}
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
              <b className="block font-mono-numbers text-[0.9375rem] text-[var(--flow-band-fg)]">{side}</b>
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
            <span className="shrink-0 whitespace-nowrap">{scale[0]}</span>
            <span className="min-w-0 truncate whitespace-nowrap">{scale[1]}</span>
            <span className="min-w-0 truncate whitespace-nowrap">{scale[2]}</span>
          </BandScale>
        </>
      )}
    />
  )
}
