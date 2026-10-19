'use client'

import { ChevronRight } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { SelectableCard } from '@/components/ui/SelectableCard'
import type { Insight } from '@/lib/budget/insights'
import { useBudgetChromeCopy } from './useBudgetCopy'

/** "N things worth a look" entry; renders nothing when there are none. */
export function InsightsChip({ insights, onOpen }: { insights: Insight[]; onOpen: () => void }) {
  const c = useBudgetChromeCopy().insights
  if (insights.length === 0) return null
  return (
    <SelectableCard as="action" layout="row" surface="card" onClick={onOpen} className="gap-3 px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)]">
        <BuddgyIcon mood="curious" size={24} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{c.count(insights.length)}</span>
        <span className="truncate text-xs text-[var(--color-brand-text-secondary)]">
          {insights.map((i) => c.short[i.kind]).join(' · ')}
        </span>
      </span>
      <span className="font-mono-numbers inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] px-2 text-xs font-semibold text-[var(--color-brand-primary-ink)]">
        {insights.length}
      </span>
      <ChevronRight className="size-4 shrink-0 text-[var(--color-brand-text-muted)] rtl:rotate-180" aria-hidden />
    </SelectableCard>
  )
}
