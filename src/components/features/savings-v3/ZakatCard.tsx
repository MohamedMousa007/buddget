'use client'

import { ChevronRight, Scale } from 'lucide-react'
import type { ZakatResult } from '@/lib/savings/zakat'
import { rgba } from '@/lib/utils/color'
import { formatWhole as fmtNum } from '@/lib/utils/formatters'
import { SelectableCard } from '@/components/ui/SelectableCard'

export interface ZakatCardProps {
  result: ZakatResult
  /** Base for the "2.5% of {base}" sub-line (the zakatable wealth). */
  base: number
  hawlDate: string
  onOpen: () => void
}

export function ZakatCard({ result, base, hawlDate, onOpen }: ZakatCardProps) {
  const due = result.due
  const accent = due ? '#EDC463' : '#35D46F'
  return (
    <SelectableCard as="action" onClick={onOpen} className="mx-4 mt-3 block w-[calc(100%-2rem)] border-none bg-transparent p-0 hover:bg-transparent"
      style={{ borderRadius: 18 }}>
      <div className="relative overflow-hidden rounded-[18px] border bg-[var(--color-brand-card)] p-3.5"
        style={{ borderColor: rgba(accent, .28) }}>
        <div aria-hidden className="pointer-events-none absolute" style={{ width: 150, height: 150, top: -46, right: -34, background: `radial-gradient(circle, ${rgba(accent, .17)}, transparent 68%)` }} />
        <div className="relative flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: rgba(accent, .14), color: accent }}><Scale size={18} /></span>
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
    </SelectableCard>
  )
}
