'use client'

import { Sparkles } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { Button } from '@/components/ui/button'
import { useBudgetChromeCopy } from './useBudgetCopy'

export interface EmptyPlanProps {
  onStarter: () => void
  onBlank: () => void
  /** The AI studio entry; the third primary CTA renders only when this is provided. */
  onBuildWithBuddgy?: () => void
}

/** First run: no live plan yet. */
export function EmptyPlan({ onStarter, onBlank, onBuildWithBuddgy }: EmptyPlanProps) {
  const c = useBudgetChromeCopy().empty
  return (
    <section className="flex flex-col gap-3.5 rounded-3xl bg-[var(--color-brand-primary-soft)] px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-card)] shadow-sm">
          <BuddgyIcon mood="happy" size={32} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{c.headline}</h2>
          <p className="text-[13px] text-[var(--color-brand-text-secondary)]">{c.body}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {onBuildWithBuddgy ? (
          <Button size="touch" className="w-full" onClick={onBuildWithBuddgy}>
            <Sparkles aria-hidden />
            {c.buddgy}
          </Button>
        ) : null}
        <Button size="touch" variant={onBuildWithBuddgy ? 'outline' : 'default'} className="w-full" onClick={onStarter}>
          {c.starter}
        </Button>
        <Button size="touch" variant="outline" className="w-full" onClick={onBlank}>
          {c.blank}
        </Button>
      </div>
    </section>
  )
}
