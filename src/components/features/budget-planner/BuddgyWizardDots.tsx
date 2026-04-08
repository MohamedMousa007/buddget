'use client'

import type { BuddgyFlowApi, BuddgyFlowStep } from '@/hooks/useBuddgyFlow'

function dotLabel(s: BuddgyFlowStep): string {
  switch (s) {
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

/** Step navigator at top of summary card (after first visit to summary). */
export function BuddgyWizardDots({ flow }: { flow: BuddgyFlowApi }) {
  if (!flow.dotsUnlocked || flow.step !== 'summary') return null

  const { plan, buildBuddgyFlowOrder, navigateToWizardDot } = flow
  const order = buildBuddgyFlowOrder(plan)
  if (order.length === 0) return null

  const activeDot = order.length - 1

  return (
    <div className="flex flex-wrap items-center justify-center gap-2" role="tablist" aria-label="Wizard steps">
      {order.map((s, i) => {
        const active = i === activeDot
        return (
          <button
            key={`${s}-${i}`}
            type="button"
            role="tab"
            aria-selected={active}
            title={dotLabel(s)}
            onClick={() => navigateToWizardDot(i)}
            className={
              active ?
                'h-2.5 w-2.5 rounded-full bg-[var(--color-brand-red)] ring-2 ring-[var(--color-brand-red)]/40'
              : 'h-2 w-2 rounded-full bg-[#3A3A48] hover:bg-[#5A5A72]'
            }
          />
        )
      })}
    </div>
  )
}
