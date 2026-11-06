'use client'

import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { cn } from '@/lib/utils'
import { fitCellValue } from '@/components/features/hero/fitText'

/** The band's gradient, shared with the sticky strip and the status-bar cover. */
export const FLOW_BAND_BG = 'linear-gradient(120deg, var(--flow-band-a) 0%, var(--flow-band-b) 100%)'
export const BAND_FG2 = 'text-[var(--flow-band-fg-2)]'
export const BAND_MIX = 'var(--flow-band-mix)'

export interface HeroBandCell {
  label: string
  value: string
  /** Money in / out gets a small arrow chip beside the label. */
  dir?: 'in' | 'out'
}

export interface HeroBandProps {
  /** 11/700 caps label, left of the top row. */
  label: string
  /** Right side of the 22px top row (badges, chips). */
  aside?: ReactNode
  /** The 34.5px number row: big figure left, side info right. */
  numbers: ReactNode
  /** The 38.75px progress block: 12px gap, 6px bar, 5px gap, 15.75px scale row. Omit for a band with no progress. */
  bar?: ReactNode
  /** Free text under the numbers (a hint, a warning); only drawn when given. */
  note?: ReactNode
  /** Interactive content under the note (a timeline, a CTA) for cards that carry actions; only drawn when given. */
  extra?: ReactNode
  /** Three cells; the strip is 66px. Omit for a band with no facts strip. */
  cells?: [HeroBandCell, HeroBandCell, HeroBandCell]
  /** A rounded card for pages that sit in a padded column, instead of the full-bleed band. */
  contained?: boolean
  /** Shrink long cell figures instead of truncating them. Off by default: short figures render the same either way. */
  fitCells?: boolean
}

function DirChip({ dir }: { dir: 'in' | 'out' }) {
  const Arrow = dir === 'in' ? ArrowDown : ArrowUp
  return (
    <span
      aria-hidden
      className="flex size-4 shrink-0 items-center justify-center rounded-full"
      style={{ background: BAND_MIX, color: dir === 'in' ? 'var(--flow-band-in)' : 'var(--flow-band-fg)' }}
    >
      <Arrow className="size-3" strokeWidth={2.5} />
    </span>
  )
}

/** Flow's band skeleton (190px fixed): Wealth and Debts fill the same slots so the three heroes are siblings. */
export function HeroBand({ label, aside, numbers, bar, note, extra, cells, fitCells = false, contained = false }: HeroBandProps) {
  return (
    <section className={cn('text-[var(--flow-band-fg)]', contained ? 'overflow-hidden rounded-3xl' : 'border-b border-[var(--flow-band-line)]')} style={{ background: FLOW_BAND_BG }}>
      <PageContainer wide className="px-0 lg:px-0">
        <div className="px-[18px] pb-3 pt-2.5">
          <div className="flex h-[22px] items-center justify-between gap-2">
            <span className={`min-w-0 flex-1 truncate whitespace-nowrap text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${BAND_FG2}`}>{label}</span>
            {aside}
          </div>
          <div className="mt-1.5 flex h-[34.5px] items-end justify-between gap-3">{numbers}</div>
          {bar ? <div className="h-[38.75px] pt-3">{bar}</div> : null}
          {note ? <div className={`mt-2 text-xs leading-relaxed ${BAND_FG2}`}>{note}</div> : null}
          {extra}
        </div>
      </PageContainer>
      {cells ? (
      <div className="border-t bg-[var(--flow-band-deep)]" style={{ borderColor: BAND_MIX }}>
        <PageContainer wide className="grid h-[66px] grid-cols-3 px-0 lg:px-0">
          {cells.map((c, i) => (
            <div key={i} className={cn('min-w-0 pb-[11px] pe-2.5 ps-[18px] pt-2.5', i > 0 && 'border-s')} style={i > 0 ? { borderColor: BAND_MIX } : undefined}>
              <p className={`flex h-4 items-center gap-1.5 whitespace-nowrap text-[0.65625rem] font-bold uppercase tracking-[0.06em] ${BAND_FG2}`}>
                {c.dir ? <DirChip dir={c.dir} /> : null}
                <span className="min-w-0 truncate">{c.label}</span>
              </p>
              <p className={cn('mt-1 h-6 truncate whitespace-nowrap font-mono-numbers font-bold leading-6', fitCells ? fitCellValue(c.value) : 'text-base')}>{c.value}</p>
            </div>
          ))}
        </PageContainer>
      </div>
      ) : null}
    </section>
  )
}

/** Scale-row wrapper matching Flow's 15.75px mono caption line under the bar. */
export function BandScale({ children }: { children: ReactNode }) {
  return (
    <div className={`mt-[5px] flex h-[15.75px] items-center justify-between gap-2 overflow-hidden font-mono-numbers text-[0.65625rem] font-semibold leading-[15.75px] ${BAND_FG2}`}>
      {children}
    </div>
  )
}
