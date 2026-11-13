'use client'

import { Check, Flag } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { BLOCK_META, BUDGET_BLOCKS } from '@/lib/budget/blocks'
import type { BudgetBlock } from '@/lib/store/types'
import { LineIcon } from './LineIcon'
import { blockColor } from './chromeFormat'
import { useBudgetSheetsCopy } from './useSheetsCopy'
import { useBudgetBuilderCopy } from './useBuilderCopy'

export type SegmentMark = 'checked' | 'flag'

export interface SegmentRailProps {
  /** Index into the seven blocks; -1 while on a page before the first block. */
  current: number
  onSelect: (index: number) => void
  /** Shown after the "Block n of 7" label. */
  note?: string
  /**
   * State mark per block. When given, earlier blocks no longer read as "done" by position:
   * the marks are the only state besides the current icon.
   */
  marks?: (block: BudgetBlock) => SegmentMark | undefined
  /** Set false where the page shows its own "n of 7"; the caption row is then left out. */
  caption?: boolean
}

type Step = 'done' | 'current' | 'todo'

/** Position-based step state; with `marks` there is no positional "done". */
export function stepState(i: number, current: number, positional: boolean): Step {
  if (i === current) return 'current'
  return positional && i < current ? 'done' : 'todo'
}

/** The seven segment icons: the page's navigation between segments, and the builder's step strip. */
export function SegmentRail({ current, onSelect, note, marks, caption = true }: SegmentRailProps) {
  const c = useBudgetBuilderCopy()
  const names = useBudgetSheetsCopy().blocks
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between">
        {BUDGET_BLOCKS.map((b, i) => {
          const state = stepState(i, current, !marks)
          const mark = marks ? marks(b) : state === 'done' ? 'checked' : undefined
          const color = blockColor(b)
          const label = [
            c.stepLabel(names[b], state),
            c.position(i + 1, BUDGET_BLOCKS.length),
            mark && marks ? c.mark[mark] : null,
          ]
            .filter(Boolean)
            .join(', ')
          return (
            <IconButton
              key={b}
              variant="outlined"
              aria-label={label}
              aria-current={state === 'current' ? 'step' : undefined}
              onClick={() => onSelect(i)}
              className="relative"
              style={state === 'todo' ? undefined : { color, borderColor: state === 'current' ? color : 'transparent', background: `color-mix(in srgb, ${color} 16%, var(--color-brand-card))` }}
            >
              <LineIcon name={BLOCK_META[b].icon} className="size-5" />
              {mark ? (
                <span
                  className={
                    'absolute -end-1 -top-1 z-[2] flex size-[18px] items-center justify-center rounded-full border-2 border-[var(--color-brand-bg)] text-[var(--color-brand-on-primary)] ' +
                    (mark === 'checked' ? 'bg-[var(--color-brand-green)]' : 'bg-[var(--color-brand-amber)]')
                  }
                >
                  {mark === 'checked' ? <Check className="size-3" aria-hidden /> : <Flag className="size-2.5" aria-hidden />}
                </span>
              ) : null}
            </IconButton>
          )
        })}
      </div>
      {caption && current >= 0 ? (
        <div className="flex items-center justify-between gap-2 text-xs text-[var(--color-brand-text-secondary)]">
          <span className="font-semibold uppercase tracking-wider">{c.blockOf(current + 1, BUDGET_BLOCKS.length)}</span>
          {note ? <span className="text-end">{note}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
