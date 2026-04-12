'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
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
 * Step 2: Lifestyle — pick pills, then explicit Next (no auto-advance).
 */
export function BuddgyStepLifestyle({ flow }: { flow: BuddgyBuilderApi }) {
  const { lifestyle, setLifestyle, confirmLifestyle } = flow
  /** Sub-step index; only changes via Next (no effect sync — avoids setState-in-effect lint). */
  const [subIdx, setSubIdx] = useState(0)

  const subStep: SubStep = subIdx === 0 ? 'food' : subIdx === 1 ? 'transport' : 'tier'

  const canNext =
    (subIdx === 0 && Boolean(lifestyle.food)) ||
    (subIdx === 1 && Boolean(lifestyle.transport)) ||
    (subIdx === 2 && Boolean(lifestyle.tier))

  const goNext = () => {
    if (subIdx === 0 && lifestyle.food) setSubIdx(1)
    else if (subIdx === 1 && lifestyle.transport) setSubIdx(2)
    else if (subIdx === 2 && lifestyle.tier) confirmLifestyle()
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
                onClick={() => setLifestyle((prev) => ({ ...prev, food: opt.value }))}
              />
            ))}

          {subStep === 'transport' &&
            TRANSPORT_OPTIONS.map((opt) => (
              <PillButton
                key={opt.value}
                label={`${opt.icon} ${opt.label}`}
                selected={lifestyle.transport === opt.value}
                onClick={() => setLifestyle((prev) => ({ ...prev, transport: opt.value }))}
              />
            ))}

          {subStep === 'tier' &&
            TIER_OPTIONS.map((opt) => (
              <PillButton
                key={opt.value}
                label={`${opt.icon} ${opt.label}`}
                selected={lifestyle.tier === opt.value}
                onClick={() => setLifestyle((prev) => ({ ...prev, tier: opt.value }))}
              />
            ))}
        </div>
      </motion.div>

      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={goNext}
          disabled={!canNext}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
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
