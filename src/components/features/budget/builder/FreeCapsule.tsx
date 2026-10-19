'use client'

import { Layers } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { OptionChip } from '@/components/ui/OptionChip'
import { BUDGET_BLOCKS } from '@/lib/budget/blocks'
import type { PlanView } from '@/lib/budget/planView.types'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { formatCurrency } from '@/lib/utils/formatters'
import { blockColor, percentText } from '../chromeFormat'
import { useBudgetBuilderCopy } from '../useBuilderCopy'

/** Sticky "left to assign" readout: amber when under-assigned, green when balanced, red when over. */
export function FreeCapsule({ view, onToBuffer }: { view: PlanView; onToBuffer: () => void }) {
  const c = useBudgetBuilderCopy().capsule
  const over = view.free < 0
  const tone = view.balanced ? 'var(--color-brand-green)' : over ? 'var(--color-brand-red-text)' : 'var(--color-brand-amber)'
  const pct = view.income > 0 ? (Math.abs(view.free) / view.income) * 100 : 0
  const denom = Math.max(view.income, view.flow.reduce((s, x) => s + x.amount, 0)) || 1
  return (
    <Card padding="md" className="sticky top-[calc(var(--app-header-h)+env(safe-area-inset-top,0px))] z-10 lg:top-[var(--app-header-h-lg)] flex flex-col gap-3 shadow-md">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={microClassName}>{c.left}</span>
          <span className="font-mono-numbers text-[28px] font-semibold leading-none tracking-[-0.02em]" style={{ color: tone }}>
            {formatCurrency(Math.abs(view.free), view.base, false)}
          </span>
        </div>
        <span className="text-end text-xs font-semibold" style={{ color: tone }}>
          {view.balanced ? c.balanced : over ? c.overBy(percentText(pct)) : c.notPlanned(percentText(pct))}
        </span>
      </div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-md bg-[var(--color-brand-elevated)]">
        {BUDGET_BLOCKS.map((b) => (
          <span
            key={b}
            className="block h-full rounded"
            style={{ width: `${(view.totals[b] / denom) * 100}%`, background: blockColor(b) }}
          />
        ))}
      </div>
      {view.free > 0 ? (
        <OptionChip as="trigger" size="md" surface="card" onClick={onToBuffer}>
          <Layers aria-hidden />
          {c.toBuffer}
        </OptionChip>
      ) : null}
    </Card>
  )
}
