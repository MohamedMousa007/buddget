'use client'

import { useMemo } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { buildFactsFromStore } from '@/lib/budget/factsFromStore'
import { useFinanceStore } from '@/lib/store/useFinanceStore'
import { useBudgetChromeCopy } from './useBudgetCopy'

export interface EmptyPlanProps {
  onBuildWithBuddgy: () => void
  onManual: () => void
}

/** First run: no live plan yet. Buddgy leads; building by hand sits one tap below. */
export function EmptyPlan({ onBuildWithBuddgy, onManual }: EmptyPlanProps) {
  const c = useBudgetChromeCopy().empty
  // Months of spending the app already holds; with some, the run shrinks to the gaps.
  const months = useMemo(() => buildFactsFromStore(useFinanceStore.getState(), new Date()).averageCycles ?? 0, [])
  const drafted = months > 0
  return (
    <EmptyState
      className="min-h-[60vh]"
      illustration={<BuddgyIcon mood="happy" size={72} />}
      title={drafted ? c.drafted.headline(months) : c.headline}
      description={drafted ? c.drafted.body : c.body}
      action={
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Button size="cta" className="w-full" onClick={onBuildWithBuddgy}>
            <Sparkles aria-hidden />
            {drafted ? c.drafted.cta : c.buddgy}
          </Button>
          <Button size="touch" variant="ghost" className="w-full" onClick={onManual}>
            {c.manual}
          </Button>
        </div>
      }
    >
      {drafted ? null : (
        <ul className="mx-auto flex max-w-sm flex-col gap-2">
          {c.points.map((point) => (
            <li key={point} className="flex items-center gap-2 text-sm text-[var(--color-brand-text-secondary)]">
              <Check className="size-4 shrink-0 text-[var(--color-brand-green)]" aria-hidden />
              {point}
            </li>
          ))}
        </ul>
      )}
    </EmptyState>
  )
}
