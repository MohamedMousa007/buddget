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

/**
 * Progressive step dots: count grows as the user advances; full row on summary.
 */
export function BuddgyWizardDots({ flow }: { flow: BuddgyFlowApi }) {
  const { plan, step, visitedDotCount, buildBuddgyFlowOrder, navigateToDotFromSummary, buddgyDotIndexForStep } =
    flow
  const order = buildBuddgyFlowOrder(plan)
  const visible = order.slice(0, Math.min(visitedDotCount, order.length))
  if (visible.length === 0) return null

  const activeIdx =
    step === 'summary' ? visible.length - 1 : buddgyDotIndexForStep(step, plan)

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2 pb-1"
      role="tablist"
      aria-label="Wizard steps"
    >
      {visible.map((s, i) => {
        const active = i === activeIdx
        return (
          <button
            key={`${s}-${i}`}
            type="button"
            role="tab"
            aria-selected={active}
            title={dotLabel(s)}
            onClick={() => {
              if (step !== 'summary') return
              navigateToDotFromSummary(i)
            }}
            disabled={step !== 'summary'}
            className={
              active ?
                'h-2.5 w-2.5 rounded-full bg-[var(--color-brand-red)] ring-2 ring-[var(--color-brand-red)]/40 disabled:opacity-100'
              : 'h-2 w-2 rounded-full bg-[#3A3A48] hover:bg-[#5A5A72] disabled:cursor-default disabled:hover:bg-[#3A3A48]'
            }
          />
        )
      })}
    </div>
  )
}
