'use client'

import { Info } from 'lucide-react'
import { useBudgetChromeCopy } from './useBudgetCopy'

/** One quiet line while a new plan is still mostly estimates. */
export function LearningNote() {
  const text = useBudgetChromeCopy().learning
  return (
    <p className="flex items-start gap-2 px-1 text-[0.8125rem] leading-snug text-[var(--color-brand-text-secondary)]" role="note">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      {text}
    </p>
  )
}
