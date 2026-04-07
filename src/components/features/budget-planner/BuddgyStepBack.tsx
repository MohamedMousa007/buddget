'use client'

import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'

/**
 * Previous-step control; hidden on the first wizard step.
 */
export function BuddgyStepBack({ flow }: { flow: BuddgyFlowApi }) {
  if (flow.step === 'income') return null
  return (
    <button
      type="button"
      onClick={() => flow.goBack()}
      className="cursor-pointer text-sm text-[var(--color-brand-text-muted)] hover:text-white transition-colors"
    >
      ← Back
    </button>
  )
}
