'use client'

import { ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCategoryLabel } from '@/hooks/useCategoryLabel'
import { BLOCK_META, BUDGET_BLOCKS } from '@/lib/budget/blocks'
import type { LineView, PlanView } from '@/lib/budget/planView.types'
import type { BudgetBlock } from '@/lib/store/types'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { formatWhole } from '@/lib/utils/formatters'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { LineIcon } from './LineIcon'
import { TintedTile } from './TintedTile'
import { useBudgetBlocksCopy } from './useBlocksCopy'

/** One budget line (Light touch `page-budget`): tile, name, "X left of Y" or "X over", the amount and a thin bar. */
function LineRow({ lv, month, base, onOpen }: { lv: LineView; month: boolean; base: string; onOpen: () => void }) {
  const c = useDebtsSubsLtCopy().line
  const catLabel = useCategoryLabel()
  const left = lv.amount - lv.spent
  const over = month && left < 0
  const sub = !month ? c.planned(Math.round(lv.percent)) : over ? c.over(formatWhole(-left), formatWhole(lv.amount)) : c.leftOf(formatWhole(left), formatWhole(lv.amount))
  const fill = Math.min(100, Math.max(0, lv.usedPercent))
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-[var(--color-brand-elevated)]">
      <TintedTile cat={BLOCK_META[lv.block].cat}><LineIcon name={lv.line.icon} /></TintedTile>
      <span className="min-w-0 flex-1">
        <span dir="auto" className="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{catLabel(lv.line.name)}</span>
        <span dir="auto" className="mt-0.5 block truncate text-xs" style={{ color: over ? 'var(--color-brand-amber)' : 'var(--color-brand-text-secondary)' }}>{sub}</span>
        {month ? (
          <span aria-hidden className="mt-2 block h-1 overflow-hidden rounded-full bg-[var(--color-brand-elevated)]">
            <span className="block h-full rounded-full" style={{ width: `${fill}%`, background: over || fill >= 90 ? 'var(--color-brand-amber)' : 'var(--color-brand-primary)' }} />
          </span>
        ) : null}
      </span>
      <span className="shrink-0 font-mono-numbers text-[0.9375rem] font-medium tabular-nums text-[var(--color-brand-text-primary)]">
        {formatWhole(month ? lv.spent : lv.amount)} <span className="text-[0.6875rem] font-normal text-[var(--color-brand-text-muted)]">{base}</span>
      </span>
    </button>
  )
}

/**
 * The Budget page's list below the hero: each segment is a section head (tap it for the segment page) over its lines as
 * rows. The lines are the plan's own; nothing new is stored.
 */
export function BudgetLinesList({ view, onOpenBlock, onOpenLine }: { view: PlanView; onOpenBlock: (block: BudgetBlock) => void; onOpenLine: (lineId: string) => void }) {
  const blocks = useBudgetBlocksCopy()
  const c = useDebtsSubsLtCopy().line
  const month = view.mode === 'month'
  return (
    <div className="flex flex-col gap-4">
      {BUDGET_BLOCKS.map((block) => {
        const bv = view.blocks[block]
        const name = blocks.blockName[block]
        return (
          <section key={block}>
            <Button
              variant="ghost"
              size="touch"
              onClick={() => onOpenBlock(block)}
              aria-label={c.openBlock(name)}
              className="mb-1 h-auto w-full justify-between px-1 py-1"
            >
              <span className={microClassName}>{name}</span>
              <span className="flex items-center gap-1 font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">
                {formatWhole(bv.total)}
                <ChevronRight aria-hidden className="size-4 rtl:rotate-180" />
              </span>
            </Button>
            {bv.lines.length > 0 ? (
              <Card padding="none" divide className="overflow-hidden">
                {bv.lines.map((lv) => (
                  <LineRow key={lv.line.id} lv={lv} month={month} base={view.base} onOpen={() => onOpenLine(lv.line.id)} />
                ))}
              </Card>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
