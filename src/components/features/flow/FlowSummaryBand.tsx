'use client'

import { motion } from 'framer-motion'
import { AlertCircle, Check, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type FlowBandVariant = 'budget' | 'received' | 'spent' | 'filtered' | 'noBudget' | 'loading'

export interface FlowBandStatus {
  label: string
  icon: 'check' | 'clock' | 'alert'
}

export interface FlowBandStat {
  label: string
  value: string
}

export interface FlowSummaryBandProps {
  variant: FlowBandVariant
  /** 11/700 caps, e.g. "Left to spend · September". */
  label: string
  status?: FlowBandStatus
  /** Pre-formatted figures. */
  big?: string
  of?: string
  side?: string
  sideSub?: string
  /** Fill 0–100 and an optional pace tick 0–100. No bar when absent. */
  bar?: { pct: number; tick?: number }
  scale?: [string, string, string]
  /** `noBudget` only. */
  noBudgetLine?: string
  setBudgetLabel?: string
  onSetBudget?: () => void
  stats: FlowBandStat[]
}

const STATUS_ICON = { check: Check, clock: Clock, alert: AlertCircle } as const
const MIX = 'var(--flow-band-mix)'

/** The band's gradient, shared with the sticky strip and the status-bar cover. */
export const FLOW_BAND_BG = 'linear-gradient(120deg, var(--flow-band-a) 0%, var(--flow-band-b) 100%)'

/**
 * Flow's full-bleed teal summary. What it measures follows the segment: All = budget and
 * pace, In = received vs expected, Out = spending, and filters narrow it. Content
 * cross-fades (160 ms) when the variant or its label changes.
 */
export function FlowSummaryBand({
  variant,
  label,
  status,
  big,
  of,
  side,
  sideSub,
  bar,
  scale,
  noBudgetLine,
  setBudgetLabel,
  onSetBudget,
  stats,
}: FlowSummaryBandProps) {
  const StatusIcon = status ? STATUS_ICON[status.icon] : null
  return (
    <section
      className="mt-1.5 border-y border-[var(--flow-band-line)] text-[var(--flow-band-fg)]"
      style={{ background: FLOW_BAND_BG }}
    >
      <motion.div
        key={`${variant}:${label}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
      >
        <div className="px-[18px] pb-3 pt-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.08em]">
              {label}
            </span>
            {status && StatusIcon ? (
              <span
                className="inline-flex h-[22px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11.5px] font-bold"
                style={{ background: MIX }}
              >
                <StatusIcon className="size-[13px]" strokeWidth={2.5} aria-hidden />
                {status.label}
              </span>
            ) : null}
          </div>

          {variant === 'loading' ? (
            <div className="mt-2.5 flex flex-col gap-2.5" aria-hidden>
              <div className="h-[30px] w-[180px] rounded-lg" style={{ background: MIX }} />
              <div className="h-1.5 rounded-full" style={{ background: MIX }} />
              <div className="h-2.5 w-[120px] rounded-md" style={{ background: MIX }} />
            </div>
          ) : (
            <>
              <div className="mt-1.5 flex items-end justify-between gap-3">
                <p className="flex min-w-0 flex-wrap items-baseline gap-1.5">
                  <span className="font-mono-numbers text-[32px] font-semibold leading-none tracking-[-0.03em]">{big}</span>
                  {of ? <span className="text-[13px]">{of}</span> : null}
                </p>
                {side ? (
                  <p className="shrink-0 text-end text-[11.5px] leading-[1.3]">
                    <b className="block font-mono-numbers text-[15px]">{side}</b>
                    {sideSub}
                  </p>
                ) : null}
              </div>
              {bar ? (
                <>
                  <div className="relative mt-3 h-1.5 rounded-full" style={{ background: MIX }}>
                    <div
                      className="h-full rounded-full bg-[var(--flow-band-fg)]"
                      style={{ width: `${Math.max(0, Math.min(100, bar.pct))}%` }}
                    />
                    {bar.tick !== undefined ? (
                      <span
                        className="absolute -bottom-1 -top-1 w-[3px] rounded-[2px] bg-[var(--flow-band-fg)] shadow-[0_0_0_1.5px_var(--flow-band-b)]"
                        style={{ insetInlineStart: `${Math.max(0, Math.min(100, bar.tick))}%` }}
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  {scale ? (
                    <div className="mt-[5px] flex justify-between gap-2 font-mono-numbers text-[10.5px] font-semibold">
                      <span>{scale[0]}</span>
                      <span>{scale[1]}</span>
                      <span>{scale[2]}</span>
                    </div>
                  ) : null}
                </>
              ) : null}
              {variant === 'noBudget' && onSetBudget ? (
                <div className="mt-2.5 flex items-center justify-between gap-2.5">
                  <span className="text-[12.5px]">{noBudgetLine}</span>
                  <Button variant="secondary" size="touch" onClick={onSetBudget}>
                    {setBudgetLabel}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="grid grid-cols-3 border-t" style={{ borderColor: MIX }}>
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={cn('min-w-0 pb-[11px] pe-2.5 ps-[18px] pt-2.5', i > 0 && 'border-s')}
              style={i > 0 ? { borderColor: MIX } : undefined}
            >
              <p className="text-[11px] font-semibold">{s.label}</p>
              <p className="mt-0.5 whitespace-nowrap font-mono-numbers text-[15px] font-bold">{s.value}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
