'use client'

import { motion } from 'framer-motion'
import type { BuddgyBuilderApi } from '@/hooks/useBuddgyBuilderFlow'
import type { FoodFrequency, TransportMode, LifestyleTier } from '@/lib/budget/lifestyleMappings'

type SubStep = 'food' | 'transport' | 'tier'

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
 * Step 2: Lifestyle choices — tappable pills; advances immediately (no duplicate progress row).
 */
export function BuddgyStepLifestyle({ flow }: { flow: BuddgyBuilderApi }) {
  const { lifestyle, setLifestyle, confirmLifestyle } = flow

  const subStep: SubStep =
    !lifestyle.food ? 'food'
    : !lifestyle.transport ? 'transport'
    : 'tier'

  const selectFood = (v: FoodFrequency) => {
    setLifestyle((prev) => ({ ...prev, food: v }))
  }

  const selectTransport = (v: TransportMode) => {
    setLifestyle((prev) => ({ ...prev, transport: v }))
  }

  const selectTier = (v: LifestyleTier) => {
    setLifestyle((prev) => ({ ...prev, tier: v }))
    confirmLifestyle()
  }

  return (
    <div className="space-y-4">
      <motion.div
        key={subStep}
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        <p className="text-sm text-[var(--color-brand-text-primary)]">{PROMPTS[subStep]}</p>

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
