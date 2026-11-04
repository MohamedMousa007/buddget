'use client'

import { Check } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { BLOCK_META, BUDGET_BLOCKS } from '@/lib/budget/blocks'
import { LineIcon } from '../LineIcon'
import { blockColor } from '../chromeFormat'
import { useBudgetSheetsCopy } from '../useSheetsCopy'
import { useBudgetBuilderCopy } from '../useBuilderCopy'

export interface BlockStepperProps {
  /** Index into the seven blocks; -1 while on a page before the first block. */
  current: number
  onSelect: (index: number) => void
  /** Shown after the "Block n of 7" label. */
  note?: string
}

/** The seven block icons with done / current / to-do state, shared by the builder and the review. */
export function BlockStepper({ current, onSelect, note }: BlockStepperProps) {
  const c = useBudgetBuilderCopy()
  const names = useBudgetSheetsCopy().blocks
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between">
        {BUDGET_BLOCKS.map((b, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo'
          const color = blockColor(b)
          return (
            <IconButton
              key={b}
              variant="outlined"
              aria-label={c.stepLabel(names[b], state)}
              aria-current={state === 'current' ? 'step' : undefined}
              onClick={() => onSelect(i)}
              className="relative"
              style={state === 'todo' ? undefined : { color, borderColor: state === 'current' ? color : 'transparent', background: `color-mix(in srgb, ${color} 16%, var(--color-brand-card))` }}
            >
              <LineIcon name={BLOCK_META[b].icon} className="size-5" />
              {state === 'done' ? (
                <span className="absolute -end-1 -top-1 z-[2] flex size-[18px] items-center justify-center rounded-full border-2 border-[var(--color-brand-bg)] bg-[var(--color-brand-green)] text-[var(--color-brand-on-primary)]">
                  <Check className="size-3" aria-hidden />
                </span>
              ) : null}
            </IconButton>
          )
        })}
      </div>
      {current >= 0 ? (
        <div className="flex items-center justify-between gap-2 text-xs text-[var(--color-brand-text-secondary)]">
          <span className="font-semibold uppercase tracking-wider">{c.blockOf(current + 1, BUDGET_BLOCKS.length)}</span>
          {note ? <span className="text-end">{note}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
