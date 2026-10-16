'use client'

import type { ReactNode } from 'react'
import { FLOW_BAND_BG } from '@/components/features/flow/FlowSummaryBand'
import { PageContainer } from '@/components/layout/PageContainer'
import { cn } from '@/lib/utils'

export const BAND_FG2 = 'text-[var(--flow-band-fg-2)]'
export const BAND_MIX = 'var(--flow-band-mix)'

export interface HeroBandCell {
  label: string
  value: string
}

export interface HeroBandProps {
  /** 11/700 caps label, left of the top row. */
  label: string
  /** Right side of the 22px top row (badges, chips). */
  aside?: ReactNode
  /** The 34.5px number row: big figure left, side info right. */
  numbers: ReactNode
  /** The 38.75px progress block: 12px gap, 6px bar, 5px gap, 15.75px scale row. */
  bar: ReactNode
  /** Always three cells; the strip is 66px. */
  cells: [HeroBandCell, HeroBandCell, HeroBandCell]
}

/** Flow's band skeleton (190px fixed): Wealth and Debts fill the same slots so the three heroes are siblings. */
export function HeroBand({ label, aside, numbers, bar, cells }: HeroBandProps) {
  return (
    <section className="border-b border-[var(--flow-band-line)] text-[var(--flow-band-fg)]" style={{ background: FLOW_BAND_BG }}>
      <PageContainer wide className="px-0 lg:px-0">
        <div className="px-[18px] pb-3 pt-2.5">
          <div className="flex h-[22px] items-center justify-between gap-2">
            <span className={`min-w-0 flex-1 truncate whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.08em] ${BAND_FG2}`}>{label}</span>
            {aside}
          </div>
          <div className="mt-1.5 flex h-[34.5px] items-end justify-between gap-3">{numbers}</div>
          <div className="h-[38.75px] pt-3">{bar}</div>
        </div>
      </PageContainer>
      <div className="border-t bg-[var(--flow-band-deep)]" style={{ borderColor: BAND_MIX }}>
        <PageContainer wide className="grid h-[66px] grid-cols-3 px-0 lg:px-0">
          {cells.map((c, i) => (
            <div key={i} className={cn('min-w-0 pb-[11px] pe-2.5 ps-[18px] pt-2.5', i > 0 && 'border-s')} style={i > 0 ? { borderColor: BAND_MIX } : undefined}>
              <p className={`flex h-4 items-center whitespace-nowrap text-[10.5px] font-bold uppercase tracking-[0.06em] ${BAND_FG2}`}>
                <span className="min-w-0 truncate">{c.label}</span>
              </p>
              <p className="mt-1 h-6 truncate whitespace-nowrap font-mono-numbers text-base font-bold leading-6">{c.value}</p>
            </div>
          ))}
        </PageContainer>
      </div>
    </section>
  )
}

/** Scale-row wrapper matching Flow's 15.75px mono caption line under the bar. */
export function BandScale({ children }: { children: ReactNode }) {
  return (
    <div className={`mt-[5px] flex h-[15.75px] items-center justify-between gap-2 overflow-hidden font-mono-numbers text-[10.5px] font-semibold leading-[15.75px] ${BAND_FG2}`}>
      {children}
    </div>
  )
}
