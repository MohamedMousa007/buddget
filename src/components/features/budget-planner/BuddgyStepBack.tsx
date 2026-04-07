'use client'

import { cn } from '@/lib/utils'
import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'

const ghostBackClass =
  'cursor-pointer rounded-xl border border-transparent px-4 py-2.5 text-sm font-medium text-[var(--color-brand-text-secondary)] hover:text-white hover:bg-white/5 transition-colors'

/**
 * Previous-step control; hidden on the first wizard step. Ghost/secondary style.
 */
export function BuddgyStepBack({
  flow,
  className,
}: {
  flow: BuddgyFlowApi
  className?: string
}) {
  if (flow.step === 'income') return null
  return (
    <button type="button" onClick={() => flow.goBack()} className={cn(ghostBackClass, className)}>
      ← Back
    </button>
  )
}
