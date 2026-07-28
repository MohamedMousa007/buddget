'use client'

import { ChevronRight, Scale } from 'lucide-react'
import type { ZakatResult } from '@/lib/savings/zakat'

const fmtNum = (n: number) => Math.round(n).toLocaleString('en-US')

export interface ZakatCardProps {
  result: ZakatResult
  /** Base for the "2.5% of {base}" sub-line (the zakatable wealth). */
  base: number
  hawlDate: string
  onOpen: () => void
}

export function ZakatCard({ result, base, hawlDate, onOpen }: ZakatCardProps) {
  const due = result.due
  const accent = due ? '#F5C842' : '#35D46F'
  return (
    <button type="button" onClick={onOpen} className="mx-4 mt-3 block w-full text-left"
      style={{ borderRadius: 18 }}>
      <div className="relative overflow-hidden rounded-[18px] border bg-[var(--color-brand-card)] p-3.5"
        style={{ borderColor: `rgba(${hexToRgb(accent)},.28)` }}>
        <div aria-hidden className="pointer-events-none absolute" style={{ width: 150, height: 150, top: -46, right: -34, background: `radial-gradient(circle, rgba(${hexToRgb(accent)},.17), transparent 68%)` }} />
        <div className="relative flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `rgba(${hexToRgb(accent)},.14)`, color: accent }}><Scale size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-[var(--color-brand-text-primary)]">{due ? 'Zakat is due' : 'No zakat due'}</p>
            <p className="font-mono-numbers text-[11px] text-[var(--color-brand-text-muted)]">{due ? `2.5% of ${fmtNum(base)} EGP` : `Nisab is ${fmtNum(result.nisab)} EGP`}</p>
          </div>
          <span className="font-mono-numbers text-[17px] font-semibold" style={{ color: accent }}>{due ? fmtNum(result.zakat) : '—'}</span>
          <ChevronRight size={18} className="text-[var(--color-brand-text-muted)]" />
        </div>
        <p className="relative mt-2 text-[10.5px] text-[var(--color-brand-text-muted)]">
          {due ? `Above nisab for a full lunar year · due by ${hawlDate}` : `You are ${fmtNum(result.gap)} EGP under the line, so nothing is owed.`}
        </p>
      </div>
    </button>
  )
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`
}
