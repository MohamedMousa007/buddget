'use client'

import { useRef } from 'react'
import type { BudgetHousehold } from '@/lib/store/types'
import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'
import { BuddgyStepBack } from '@/components/features/budget-planner/BuddgyStepBack'

const pills: { id: BudgetHousehold; label: string }[] = [
  { id: 'solo', label: 'Just me' },
  { id: 'partner', label: 'Me + partner' },
  { id: 'family', label: 'Family' },
]

export function BuddgyStepHousehold({ flow }: { flow: BuddgyFlowApi }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pick = (h: BudgetHousehold) => {
    if (timer.current) globalThis.clearTimeout(timer.current)
    flow.saveHousehold(h)
    timer.current = globalThis.setTimeout(() => {
      flow.advanceFromStep('household')
    }, 400)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white font-sans">Who&apos;s sharing this budget?</p>
      <div className="flex flex-wrap gap-2">
        {pills.map((p) => {
          const selected = flow.household === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p.id)}
              className={
                selected ?
                  'cursor-pointer rounded-full border border-transparent bg-[var(--color-brand-red)] px-4 py-2 text-sm font-medium text-white'
                : 'cursor-pointer rounded-full border border-[#2A2A38] bg-[#1A1A24] px-4 py-2 text-sm font-medium text-white hover:bg-[#1A1A24]/90'
              }
            >
              {p.label}
            </button>
          )
        })}
      </div>
      <div className="pt-2">
        <BuddgyStepBack flow={flow} />
      </div>
    </div>
  )
}
