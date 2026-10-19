'use client'

import { CalendarDays, Plus, Trash2 } from 'lucide-react'
import { AmountField } from '@/components/ui/AmountField'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { IconButton } from '@/components/ui/IconButton'
import { OptionChip } from '@/components/ui/OptionChip'
import { BLOCK_META } from '@/lib/budget/blocks'
import type { DraftLine } from '@/lib/budget/facts'
import type { BlockView, LineView } from '@/lib/budget/planView.types'
import { findAdded } from '@/lib/budget/templates'
import type { BudgetBlock, BudgetPlanCategory, Currency } from '@/lib/store/types'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { formatCurrency } from '@/lib/utils/formatters'
import { percentText } from '../chromeFormat'
import { LineIcon } from '../LineIcon'
import { TintedTile } from '../TintedTile'
import { useBudgetSheetsCopy } from '../useSheetsCopy'
import { useBudgetBuilderCopy } from '../useBuilderCopy'

export interface BuilderBlockStepProps {
  block: BudgetBlock
  view: BlockView
  base: Currency
  planLines: readonly BudgetPlanCategory[]
  suggestions: DraftLine[]
  onToggleSuggestion: (s: DraftLine, added: BudgetPlanCategory | undefined) => void
  onAmount: (line: LineView, amount: number) => void
  onRemove: (line: LineView) => void
  onOpenLine: (id: string) => void
  onAdd: () => void
}

/** One block of the manual builder: engine suggestions as chips, editable rows, an add button. */
export function BuilderBlockStep(p: BuilderBlockStepProps) {
  const c = useBudgetBuilderCopy()
  const blockName = useBudgetSheetsCopy().blocks[p.block]
  const meta = BLOCK_META[p.block]
  const money = (n: number) => formatCurrency(n, p.base, false)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <TintedTile cat={meta.cat} size="sm">
          <LineIcon name={meta.icon} />
        </TintedTile>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-[var(--color-brand-text-primary)]">{blockName}</p>
          <p className="text-xs text-[var(--color-brand-text-secondary)]">{c.blockHints[p.block]}</p>
        </div>
        <div className="text-end">
          <p className="font-mono-numbers text-base font-semibold text-[var(--color-brand-text-primary)]">{money(p.view.total)}</p>
          <p className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">{percentText(p.view.percent)}</p>
        </div>
      </div>

      {p.suggestions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className={microClassName}>{c.found}</span>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {p.suggestions.map((s) => {
              const added = findAdded(p.planLines, p.block, s)
              return (
                <OptionChip
                  key={`${s.name}-${s.linkIds.join()}`}
                  as="trigger"
                  size="md"
                  surface="card"
                  selected={!!added}
                  onClick={() => p.onToggleSuggestion(s, added)}
                >
                  <LineIcon name={s.icon} />
                  {s.name} <span className="font-mono-numbers">{money(s.amount)}</span>
                </OptionChip>
              )
            })}
          </div>
        </div>
      ) : null}

      {p.view.lines.length === 0 ? <p className="text-sm text-[var(--color-brand-text-secondary)]">{c.empty}</p> : null}
      {p.view.lines.map((l) => {
        const linked = l.line.linkType !== 'none' && l.line.linkType !== undefined
        return (
          <Card key={l.line.id} padding="md" className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <TintedTile cat={meta.cat} size="sm">
                <LineIcon name={l.line.icon} />
              </TintedTile>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-[var(--color-brand-text-primary)]">{l.line.name}</p>
                {linked ? <p className="text-xs text-[var(--color-brand-text-secondary)]">{c.linkedFromPage}</p> : null}
              </div>
              <IconButton variant="danger" aria-label={c.remove(l.line.name)} onClick={() => p.onRemove(l)}>
                <Trash2 />
              </IconButton>
            </div>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <AmountField
                  value={String(l.amount)}
                  onChange={(v) => p.onAmount(l, Number(v) || 0)}
                  currency={p.base}
                  label={c.amountOf(l.line.name)}
                  disabled={linked}
                />
              </div>
              <span className="font-mono-numbers w-11 text-end text-xs text-[var(--color-brand-text-secondary)]">{percentText(l.percent)}</span>
            </div>
            {p.block === 'bills' ? (
              <Button size="touch" variant="outline" className="self-start" onClick={() => p.onOpenLine(l.line.id)}>
                <CalendarDays aria-hidden />
                {l.dueDay ? c.due(String(l.dueDay)) : c.noDue}
              </Button>
            ) : null}
          </Card>
        )
      })}

      <Button size="touch" variant="outline" className="w-full" onClick={p.onAdd}>
        <Plus aria-hidden />
        {c.addLine(blockName)}
      </Button>
    </div>
  )
}
