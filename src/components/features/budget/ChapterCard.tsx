'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { ChapterView, PlanMode } from '@/lib/budget/planView.types'
import type { Currency } from '@/lib/store/types'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/formatters'
import { blockColor, percentText } from './chromeFormat'
import { useBudgetChromeCopy } from './useBudgetCopy'

export interface ChapterCardProps {
  chapter: ChapterView
  /** 1-based position among the chapters. */
  index: number
  chapterCount?: number
  mode: PlanMode
  base: Currency
  expanded: boolean
  onToggle: () => void
  children: ReactNode
}

/** A collapsible chapter (must pay, live, secure): tinted header with block rail, then its blocks. */
export function ChapterCard({ chapter, index, chapterCount = 3, mode, base, expanded, onToggle, children }: ChapterCardProps) {
  const c = useBudgetChromeCopy()
  const meta = c.chapters[chapter.chapter]
  const money = (n: number) => formatCurrency(n, base, false)
  const month = mode === 'month'
  const weights = chapter.blocks.map((b) => b.total)
  const sum = weights.reduce((s, w) => s + w, 0)
  const weight = (w: number) => (sum > 0 ? w : 1)
  const tint = blockColor(chapter.blocks[0].block)
  const bodyId = `chapter-${chapter.chapter}`

  return (
    <Card padding="none" className="flex overflow-hidden">
      <div className="flex w-1.5 shrink-0 flex-col gap-0.5" aria-hidden>
        {chapter.blocks.map((b) => (
          <i key={b.block} className="block" style={{ flex: weight(b.total), background: blockColor(b.block) }} />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={(expanded ? c.chapter.collapse : c.chapter.expand)(meta.name)}
          onClick={onToggle}
          className="block w-full py-3.5 pe-3.5 ps-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-focus)]/55"
          style={{ background: `color-mix(in srgb, ${tint} 8%, var(--color-brand-card))` }}
        >
          <span className="flex items-center gap-3">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={`${microClassName} whitespace-nowrap`}>{c.chapter.index(index, chapterCount)}</span>
              <span className="text-[19px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{meta.name}</span>
              <span className="text-xs text-[var(--color-brand-text-secondary)]">{meta.sub}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end">
              <span className="font-mono-numbers text-[17px] font-semibold text-[var(--color-brand-text-primary)]">
                {money(month ? chapter.spent : chapter.total)}
              </span>
              <span className="font-mono-numbers text-xs text-[var(--color-brand-text-secondary)]">
                {month ? c.chapter.spentOf(money(chapter.spent), money(chapter.total)) : percentText(chapter.percent)}
              </span>
            </span>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] text-[var(--color-brand-text-secondary)]">
              <ChevronDown className={cn('size-5 transition-transform', expanded && 'rotate-180')} aria-hidden />
            </span>
          </span>
          <span className="mt-3 flex h-1.5 gap-0.5" aria-hidden>
            {chapter.blocks.map((b) => {
              const color = blockColor(b.block)
              const used = month && b.total > 0 ? Math.min(100, (b.spent / b.total) * 100) : 100
              return (
                <i
                  key={b.block}
                  className="relative block h-full overflow-hidden rounded"
                  style={{
                    flex: weight(b.total),
                    background: month ? `color-mix(in srgb, ${color} 22%, var(--color-brand-elevated))` : color,
                  }}
                >
                  {month ? <i className="absolute inset-y-0 start-0 block" style={{ width: `${used}%`, background: color }} /> : null}
                </i>
              )
            })}
          </span>
          <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {chapter.blocks.map((b) => (
              <span key={b.block} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--color-brand-text-secondary)]">
                <span className="size-2 rounded-full" style={{ background: blockColor(b.block) }} aria-hidden />
                {c.blocks[b.block].short}
                <span className="font-mono-numbers font-semibold text-[var(--color-brand-text-primary)]">{money(month ? b.spent : b.total)}</span>
              </span>
            ))}
          </span>
        </button>
        <div id={bodyId} hidden={!expanded}>
          {children}
        </div>
      </div>
    </Card>
  )
}

