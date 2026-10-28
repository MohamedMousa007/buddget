'use client'

import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { Button } from '@/components/ui/button'
import { microClassName } from '@/lib/ui/microLabelStyle'
import { useBudgetStudioCopy } from '../useStudioCopy'

export interface DraftStepProps {
  months: number
  onReview: () => void
  onQuestions: () => void
}

/** When the app already holds income and spending history: build now from it, or sharpen it with a few questions first. */
export function DraftStep({ months, onReview, onQuestions }: DraftStepProps) {
  const c = useBudgetStudioCopy().draft
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-3">
        <BuddgyIcon mood="happy" size={44} />
        <p className={`${microClassName} pb-1`}>{c.kicker}</p>
      </div>
      <h1 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--color-brand-text-primary)]">{c.title(months)}</h1>
      <p className="text-[13.5px] text-[var(--color-brand-text-secondary)]">{c.body}</p>
      <div className="flex flex-col gap-2">
        <Button size="cta" className="w-full" onClick={onReview}>
          {c.review}
        </Button>
        <Button size="touch" variant="ghost" className="w-full" onClick={onQuestions}>
          {c.questions}
        </Button>
      </div>
    </div>
  )
}
