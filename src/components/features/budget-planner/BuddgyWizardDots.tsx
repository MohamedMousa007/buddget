'use client'

import type { BuddgyFlowApi, BuddgyFlowStep } from '@/hooks/useBuddgyFlow'

function dotLabel(step: BuddgyFlowStep): string {
  switch (step) {
    case 'income':
      return 'Income'
    case 'household':
      return 'Household'
    case 'rent':
      return 'Rent'
    case 'dewa':
      return 'DEWA'
    case 'transportMode':
    case 'transportDetail':
      return 'Transport'
    case 'savings':
      return 'Savings'
    default:
      return ''
  }
}

/** Full step navigator; only rendered on the final summary screen. */
export function BuddgyWizardDots({ flow }: { flow: BuddgyFlowApi }) {
  if (flow.step !== 'summary') return null

  const { plan, buildBuddgyFlowOrder, navigateToDotFromSummary } = flow
  const order = buildBuddgyFlowOrder(plan)
  if (order.length === 0) return null

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2 pb-3"
      role="tablist"
      aria-label="Wizard steps"
    >
      {order.map((s, i) => (
        <button
          key={`${s}-${i}`}
          type="button"
          role="tab"
          aria-selected={false}
          title={dotLabel(s)}
          onClick={() => navigateToDotFromSummary(i)}
          className="h-2.5 w-2.5 rounded-full bg-[#3A3A48] hover:bg-[#5A5A72] hover:ring-2 hover:ring-[var(--color-brand-red)]/30"
        />
      ))}
    </div>
  )
}
