'use client'

import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { OptionChip } from '@/components/ui/OptionChip'
import { BLOCK_META } from '@/lib/budget/blocks'
import type { PlanView } from '@/lib/budget/planView.types'
import type { BudgetBlock } from '@/lib/store/types'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { formatCurrency } from '@/lib/utils/formatters'
import { blockColor, percentText } from './chromeFormat'
import { LineIcon } from './LineIcon'
import { useBudgetChromeCopy } from './useBudgetCopy'

export interface FlowStripProps {
  view: PlanView
  onFix: () => void
  onJump: (block: BudgetBlock) => void
}

/** Income, balanced state, the proportional block strip and its legend. */
export function FlowStrip({ view, onFix, onJump }: FlowStripProps) {
  const c = useBudgetChromeCopy()
  const { flow: f } = c
  const month = view.mode === 'month'
  const money = (n: number) => formatCurrency(n, view.base, false)
  const assigned = view.flow.reduce((s, x) => s + x.amount, 0)
  const denom = Math.max(view.income, assigned) || 1
  const marker = month && view.daysInCycle > 0 ? Math.min(100, (view.dayOfCycle / view.daysInCycle) * 100) : null
  const over = view.free < 0

  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={microClassName}>{month ? f.monthLabel : f.planLabel}</span>
          <span className="font-mono-numbers whitespace-nowrap text-[28px] font-semibold leading-none tracking-[-0.02em] text-[var(--color-brand-text-primary)]">
            {money(month ? view.flow.reduce((s, x) => s + view.blocks[x.block].spent, 0) : view.income)}
          </span>
        </div>
        {view.balanced ? (
          <Badge variant="positive" className="h-7 px-2.5 font-semibold">
            <Check aria-hidden />
            {f.balanced}
          </Badge>
        ) : (
          <span
            className={
              'font-mono-numbers shrink-0 text-xs font-semibold ' +
              (over ? 'text-[var(--color-brand-red-text)]' : 'text-[var(--color-brand-amber)]')
            }
          >
            {over ? f.over(money(-view.free)) : f.stillFree(money(view.free))}
          </span>
        )}
      </div>

      <div className="relative pb-0.5">
        <div className="flex h-3.5 gap-0.5 overflow-hidden rounded-md bg-[var(--color-brand-elevated)]">
          {view.flow.map((x) => {
            const color = blockColor(x.block)
            const used = x.amount > 0 ? Math.min(100, (view.blocks[x.block].spent / x.amount) * 100) : 0
            return (
              <span
                key={x.block}
                className="relative block h-full overflow-hidden rounded"
                style={{
                  width: `${(x.amount / denom) * 100}%`,
                  background: month ? `color-mix(in srgb, ${color} 22%, var(--color-brand-elevated))` : color,
                }}
              >
                {month ? (
                  <span className="absolute inset-y-0 start-0 block" style={{ width: `${used}%`, background: color }} />
                ) : null}
              </span>
            )
          })}
        </div>
        {marker !== null ? (
          <span
            className="absolute -top-1 bottom-4 w-0.5 rounded bg-[var(--color-brand-text-primary)] opacity-70"
            style={{ insetInlineStart: `${marker}%` }}
            aria-hidden
          />
        ) : null}
        {marker !== null ? (
          <p className="mt-1.5 font-mono-numbers text-[11px] text-[var(--color-brand-text-muted)]">
            {f.dayOf(view.dayOfCycle, view.daysInCycle)}
          </p>
        ) : null}
      </div>

      {!view.balanced ? (
        <Button size="touch" onClick={onFix} className="w-full">
          {over ? f.fix : f.assign}
        </Button>
      ) : null}

      <div
        role="group"
        aria-label={f.legendLabel}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]"
      >
        {view.flow.map((x) => (
          <OptionChip
            key={x.block}
            as="trigger"
            size="sm"
            surface="card"
            aria-label={f.jumpTo(c.blocks[x.block].name)}
            onClick={() => onJump(x.block)}
          >
            <span style={{ color: blockColor(x.block) }}>
              <LineIcon name={BLOCK_META[x.block].icon} className="size-4" />
            </span>
            {c.blocks[x.block].short} <span className="font-mono-numbers">{percentText(x.percent)}</span>
          </OptionChip>
        ))}
      </div>
    </Card>
  )
}
