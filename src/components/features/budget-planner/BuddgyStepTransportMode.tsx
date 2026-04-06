'use client'

import { useRef } from 'react'
import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'

const modes = [
  { id: 'car' as const, label: '🚗 Car' },
  { id: 'public' as const, label: '🚌 Public' },
  { id: 'walk' as const, label: '🚶 Walk' },
  { id: 'mix' as const, label: 'Mix' },
]

export function BuddgyStepTransportMode({ flow }: { flow: BuddgyFlowApi }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onPick = (id: (typeof modes)[number]['id']) => {
    flow.setTransportMode(id)
    if (id === 'walk') {
      if (timer.current) globalThis.clearTimeout(timer.current)
      timer.current = globalThis.setTimeout(() => {
        flow.commitWalkTransport()
        flow.setStep('savings')
      }, 400)
      return
    }
    flow.setStep('transportDetail')
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white font-sans">How do you get around?</p>
      <div className="flex flex-wrap gap-2">
        {modes.map((m) => {
          const selected = flow.transportMode === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m.id)}
              className={
                selected ?
                  'cursor-pointer rounded-full border border-transparent bg-[var(--color-brand-red)] px-4 py-2 text-sm font-medium text-white'
                : 'cursor-pointer rounded-full border border-[#2A2A38] bg-[#1A1A24] px-4 py-2 text-sm font-medium text-white'
              }
            >
              {m.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
