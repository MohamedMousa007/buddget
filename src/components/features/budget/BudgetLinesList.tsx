'use client'

import { useState } from 'react'
import { ChevronRight, LayoutGrid } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { OptionSheet } from '@/components/ui/OptionSheet'
import { cn } from '@/lib/utils'
import { useCategoryLabel } from '@/hooks/useCategoryLabel'
import { BUDGET_BLOCKS } from '@/lib/budget/blocks'
import type { LineView, PlanView } from '@/lib/budget/planView.types'
import type { BudgetBlock } from '@/lib/store/types'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { formatWhole } from '@/lib/utils/formatters'
import { useDebtsSubsLtCopy } from '@/lib/i18n/debtsSubsLtCopy'
import { LineTile } from './LineTile'
import { useBudgetBlocksCopy } from './useBlocksCopy'

/** Brand teal, amber from 80% of the line, red once it is over (Light touch `page-budget`). */
function barColor(usedPercent: number): string {
  if (usedPercent > 100) return 'var(--color-brand-red)'
  if (usedPercent >= 80) return 'var(--color-brand-amber)'
  return 'var(--color-brand-primary)'
}

/** One budget line (Light touch `page-budget`): tile, name, "X left of Y" or "X over", the amount and a thin bar. */
function LineRow({ lv, month, base, onOpen }: { lv: LineView; month: boolean; base: string; onOpen: () => void }) {
  const c = useDebtsSubsLtCopy().line
  const catLabel = useCategoryLabel()
  const left = lv.amount - lv.spent
  const over = month && left < 0
  const sub = !month ? c.planned(Math.round(lv.percent)) : over ? c.over(formatWhole(-left), formatWhole(lv.amount)) : c.leftOf(formatWhole(left), formatWhole(lv.amount))
  const fill = Math.min(100, Math.max(0, lv.usedPercent))
  return (
    <button type="button" onClick={onOpen} className="flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-[var(--color-brand-elevated)]">
      <LineTile line={lv.line} block={lv.block} className="size-10 rounded-[11px] [&_svg]:size-5" />
      <span className="min-w-0 flex-1">
        <span dir="auto" className="block truncate text-[0.9375rem] font-semibold text-[var(--color-brand-text-primary)]">{catLabel(lv.line.name)}</span>
        <span dir="auto" className="mt-1 block truncate text-xs font-medium" style={{ color: over ? 'var(--color-brand-red-text)' : 'var(--color-brand-text-muted)' }}>{sub}</span>
        {month ? (
          <span aria-hidden className="mt-2 block h-1 overflow-hidden rounded-full bg-[var(--color-brand-elevated)]">
            <span className="block h-full rounded-full" style={{ width: `${fill}%`, background: barColor(lv.usedPercent) }} />
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
 * The Budget page's list below the hero (Light touch `page-budget`): one "Categories" card with every line as a row, in
 * the plan's group order. Each group's own page (its lines and adding one) opens from a quiet row under the list, so
 * empty groups never show on the page itself. The lines are the plan's own; nothing new is stored.
 */
export function BudgetLinesList({ view, onOpenBlock, onOpenLine }: { view: PlanView; onOpenBlock: (block: BudgetBlock) => void; onOpenLine: (lineId: string) => void }) {
  const blocks = useBudgetBlocksCopy()
  const c = useDebtsSubsLtCopy().line
  const [groupsOpen, setGroupsOpen] = useState(false)
  const month = view.mode === 'month'
  const present = BUDGET_BLOCKS.filter((b) => view.blocks[b])
  const lines = present.flatMap((b) => view.blocks[b].lines)
  return (
    <div className="flex flex-col">
      {lines.length > 0 ? (
        <section>
          <h2 className={cn(microClassName, 'mx-1 mb-2 mt-3')}>{c.categories}</h2>
          <Card padding="none" divide className="overflow-hidden">
            {lines.map((lv) => (
              <LineRow key={lv.line.id} lv={lv} month={month} base={view.base} onOpen={() => onOpenLine(lv.line.id)} />
            ))}
          </Card>
        </section>
      ) : null}
      <Button
        variant="ghost"
        size="touch"
        onClick={() => setGroupsOpen(true)}
        aria-haspopup="dialog"
        className="mt-2 self-start px-1 text-[0.8125rem] font-semibold text-[var(--color-brand-text-secondary)]"
      >
        <LayoutGrid aria-hidden />
        {c.groups}
        <ChevronRight aria-hidden className="rtl:rotate-180" />
      </Button>
      <OptionSheet<BudgetBlock>
        open={groupsOpen}
        onClose={() => setGroupsOpen(false)}
        title={c.groups}
        value={null}
        onChange={onOpenBlock}
        options={present.map((b) => ({ value: b, title: blocks.blockName[b], subtitle: `${formatWhole(view.blocks[b].total)} ${view.base}` }))}
      />
    </div>
  )
}
