'use client'

import { AlertCircle, ArrowDown, ArrowUp, Check, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PageContainer } from '@/components/layout/PageContainer'

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
const FG2 = 'text-[var(--flow-band-fg-2)]'
const MIX = 'var(--flow-band-mix)'

/** The band's gradient, shared with the sticky strip and the status-bar cover. */
export const FLOW_BAND_BG = 'linear-gradient(120deg, var(--flow-band-a) 0%, var(--flow-band-b) 100%)'

/**
 * Flow's full-bleed teal summary. Its height never changes: a 22px label row, a 34.5px
 * number row, a 38.75px bar block (12 gap + 6 bar + 5 + 15.75 scale) and a 66px stats
 * strip — every state, filter and segment fills the same slots, so only values move.
 */
export function FlowSummaryBand({ variant, label, status, setBudget, big, of, side, sideSub, bar, scale, stats }: FlowSummaryBandProps) {
  const StatusIcon = status ? STATUS_ICON[status.icon] : null
  const loading = variant === 'loading'
  return (
    <section
      className="border-b border-[var(--flow-band-line)] text-[var(--flow-band-fg)]"
      style={{ background: FLOW_BAND_BG }}
    >
      <PageContainer className="px-0 lg:px-0">
      <div className="px-[18px] pb-3 pt-2.5">
        <div className="flex h-[22px] items-center justify-between gap-2">
          <span className={`min-w-0 flex-1 truncate whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.08em] ${FG2}`}>
            {label}
          </span>
          {setBudget ? (
            <Button
              variant="onBand"
              onClick={setBudget.onPress}
              className='relative h-[26px] shrink-0 rounded-full px-2.5 text-[12px] after:absolute after:left-1/2 after:top-1/2 after:min-h-[44px] after:min-w-[44px] after:-translate-x-1/2 after:-translate-y-1/2 after:content-[""]'
            >
              {setBudget.label}
            </Button>
          ) : status && StatusIcon ? (
            <span
              className="inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[var(--flow-band-fg)] px-2 text-[11.5px] font-bold"
              style={{ color: STATUS_TONE[status.icon] }}
            >
              <StatusIcon className="size-[13px]" strokeWidth={2.5} aria-hidden />
              {status.label}
            </span>
          ) : null}
        </div>

        {loading ? (
          <div aria-hidden>
            <div className="mt-1.5 flex h-[34.5px] items-end">
              <div className="h-[30px] w-[180px] rounded-lg" style={{ background: MIX }} />
            </div>
            <div className="h-[38.75px] pt-3">
              <div className="h-1.5 rounded-full" style={{ background: MIX }} />
            </div>
          </div>
        ) : (
          <>
            <div className="mt-1.5 flex h-[34.5px] items-end justify-between gap-3">
              <p className="flex min-w-0 items-baseline gap-1.5">
                <span className="shrink-0 font-mono-numbers text-[32px] font-semibold leading-none tracking-[-0.03em]">{big}</span>
                {of ? <span className={`min-w-0 truncate whitespace-nowrap text-[13px] ${FG2}`}>{of}</span> : null}
              </p>
              {side ? (
                <p className={`shrink-0 text-end text-[11.5px] leading-[1.3] ${FG2}`}>
                  <b className="block font-mono-numbers text-[15px] text-[var(--flow-band-fg)]">{side}</b>
                  {sideSub}
                </p>
              ) : null}
            </div>
            <div className="h-[38.75px] pt-3">
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
              <div className={`mt-[5px] flex h-[15.75px] justify-between gap-2 overflow-hidden font-mono-numbers text-[10.5px] font-semibold leading-[15.75px] ${FG2}`}>
                <span className="shrink-0 whitespace-nowrap">{scale[0]}</span>
                <span className="min-w-0 truncate whitespace-nowrap">{scale[1]}</span>
                <span className="min-w-0 truncate whitespace-nowrap">{scale[2]}</span>
              </div>
            </div>
          </>
        )}
      </div>
      </PageContainer>
      {/* A deeper sub-surface groups the three stats apart from the pace above. */}
      <div className="border-t bg-[var(--flow-band-deep)]" style={{ borderColor: MIX }}>
      <PageContainer className="grid h-[66px] grid-cols-3 px-0 lg:px-0">
        {stats.map((s, i) => {
          const Arrow = s.dir === 'in' ? ArrowDown : s.dir === 'out' ? ArrowUp : null
          return (
            <div
              key={i}
              className={cn('min-w-0 pb-[11px] pe-2.5 ps-[18px] pt-2.5', i > 0 && 'border-s')}
              style={i > 0 ? { borderColor: MIX } : undefined}
            >
              <p className={`flex h-4 items-center gap-1.5 whitespace-nowrap text-[10.5px] font-bold uppercase tracking-[0.06em] ${FG2}`}>
                {Arrow ? (
                  <span
                    aria-hidden
                    className="flex size-4 shrink-0 items-center justify-center rounded-full"
                    style={{ background: MIX, color: s.dir === 'in' ? 'var(--flow-band-in)' : 'var(--flow-band-fg)' }}
                  >
                    <Arrow className="size-3" strokeWidth={2.5} />
                  </span>
                ) : null}
                <span className="min-w-0 truncate">{s.label}</span>
              </p>
              <p className="mt-1 h-6 truncate whitespace-nowrap font-mono-numbers text-base font-bold leading-6">{s.value}</p>
            </div>
          )
        })}
      </PageContainer>
      </div>
    </section>
  )
}
