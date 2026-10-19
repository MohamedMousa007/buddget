import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { BLOCK_META } from '@/lib/budget/blocks'
import type { BlockView, PlanMode } from '@/lib/budget/planView.types'
import type { Currency } from '@/lib/store/types'
import { formatCurrency } from '@/lib/utils/formatters'
import { percentText } from './chromeFormat'
import { LineIcon } from './LineIcon'
import { TintedTile } from './TintedTile'
import { useBudgetChromeCopy } from './useBudgetCopy'

export interface BlockShellProps {
  block: BlockView
  mode: PlanMode
  base: Currency
  /** Sub-line under the name ("4 bills · due the 1st to the 28th"), composed by the block body's owner. */
  sub?: ReactNode
  cta?: { label: string; onClick: () => void }
  /** Anchor so the flow legend can scroll to this block. */
  id?: string
  children: ReactNode
}

/** A block's header row (tile, name, sub-line, total, percent), its body slot and an optional CTA. */
export function BlockShell({ block, mode, base, sub, cta, id, children }: BlockShellProps) {
  const c = useBudgetChromeCopy()
  const meta = BLOCK_META[block.block]
  const month = mode === 'month'
  const money = (n: number) => formatCurrency(n, base, false)
  return (
    <section id={id} className="scroll-mt-4">
      <div className="flex items-center gap-3 px-3.5 pb-2.5 pt-4">
        <TintedTile cat={meta.cat} size="md">
          <LineIcon name={meta.icon} />
        </TintedTile>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-tight text-[var(--color-brand-text-primary)]">{c.blocks[block.block].name}</p>
          {sub ? <p className="truncate text-xs text-[var(--color-brand-text-secondary)]">{sub}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className="font-mono-numbers text-base font-semibold text-[var(--color-brand-text-primary)]">
            {money(month ? block.spent : block.total)}
          </span>
          <span className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">
            {month ? c.chapter.spentOf(money(block.spent), money(block.total)) : percentText(block.percent)}
          </span>
        </div>
      </div>
      <div className="px-3 pb-3.5">
        {children}
        {cta ? (
          <Button variant="outline" size="touch" className="mt-2 w-full" onClick={cta.onClick}>
            {cta.label}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
