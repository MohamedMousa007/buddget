'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { BuddgyBuilderApi } from '@/hooks/useBuddgyBuilderFlow'
import type { FoodFrequency, TransportMode, LifestyleTier } from '@/lib/budget/lifestyleMappings'

type SubStep = 'food' | 'transport' | 'tier'
const SUB_ORDER: SubStep[] = ['food', 'transport', 'tier']

const FOOD_OPTIONS: { value: FoodFrequency; label: string }[] = [
  { value: 'everyday', label: 'Every day' },
  { value: 'mostdays', label: 'Most days' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'rarely', label: 'Rarely' },
]

const TRANSPORT_OPTIONS: { value: TransportMode; label: string; icon: string }[] = [
  { value: 'public', label: 'Metro/bus', icon: '🚇' },
  { value: 'car', label: 'Own car', icon: '🚗' },
  { value: 'taxi', label: 'Taxis', icon: '🚕' },
  { value: 'walk', label: 'Walk mostly', icon: '🚶' },
]

const TIER_OPTIONS: { value: LifestyleTier; label: string; icon: string }[] = [
  { value: 'minimal', label: 'Minimal', icon: '🏕' },
  { value: 'balanced', label: 'Balanced', icon: '⚖️' },
  { value: 'comfortable', label: 'Comfortable', icon: '🌟' },
]

const PROMPTS: Record<SubStep, string> = {
  food: 'How often will you cook at home?',
  transport: 'How will you get around?',
  tier: 'What vibe are you going for?',
}

/**
 * Step 2: Lifestyle choices — all tappable pills, no typing.
 * Auto-advances between sub-questions after 400ms.
 */
export function BuddgyStepLifestyle({ flow }: { flow: BuddgyBuilderApi }) {
  const { lifestyle, setLifestyle, confirmLifestyle } = flow
  const [subStep, setSubStep] = useState<SubStep>('food')
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(null)

  const currentIndex = SUB_ORDER.indexOf(subStep)

  function advanceSub(next: SubStep | 'done') {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => {
      if (next === 'done') {
        confirmLifestyle()
      } else {
        setSubStep(next)
      }
    }, 400)
  }

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
  }, [])

  const selectFood = (v: FoodFrequency) => {
    setLifestyle((prev) => ({ ...prev, food: v }))
    advanceSub('transport')
  }

  const selectTransport = (v: TransportMode) => {
    setLifestyle((prev) => ({ ...prev, transport: v }))
    advanceSub('tier')
  }

  const selectTier = (v: LifestyleTier) => {
    setLifestyle((prev) => ({ ...prev, tier: v }))
    advanceSub('done')
  }

  return (
    <div className="space-y-4">
      {/* Sub-step indicators */}
      <div className="flex items-center gap-1.5 justify-center">
        {SUB_ORDER.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === currentIndex ? 'w-6 bg-[var(--color-brand-red)]'
              : i < currentIndex ? 'w-3 bg-[var(--color-brand-green)]'
              : 'w-3 bg-[var(--color-brand-border)]'
            }`}
          />
        ))}
      </div>

      <motion.div
        key={subStep}
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -60, opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-4"
      >
        <p className="text-sm text-[var(--color-brand-text-primary)]">
          {PROMPTS[subStep]}
        </p>

        <div className="flex flex-wrap gap-2">
          {subStep === 'food' &&
            FOOD_OPTIONS.map((opt) => (
              <PillButton
                key={opt.value}
                label={opt.label}
                selected={lifestyle.food === opt.value}
                onClick={() => selectFood(opt.value)}
              />
            ))}

          {subStep === 'transport' &&
            TRANSPORT_OPTIONS.map((opt) => (
              <PillButton
                key={opt.value}
                label={`${opt.icon} ${opt.label}`}
                selected={lifestyle.transport === opt.value}
                onClick={() => selectTransport(opt.value)}
              />
            ))}

          {subStep === 'tier' &&
            TIER_OPTIONS.map((opt) => (
              <PillButton
                key={opt.value}
                label={`${opt.icon} ${opt.label}`}
                selected={lifestyle.tier === opt.value}
                onClick={() => selectTier(opt.value)}
              />
            ))}
        </div>
      </motion.div>
    </div>
  )
}

function PillButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
        selected
          ? 'bg-[var(--color-brand-red)] text-white'
          : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)] hover:text-[var(--color-brand-text-primary)]'
      }`}
    >
      {label}
    </motion.button>
  )
}
