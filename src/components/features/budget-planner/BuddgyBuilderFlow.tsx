'use client'

import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useBuddgyBuilderFlow } from '@/hooks/useBuddgyBuilderFlow'
import { BuddgyProgressDots } from '@/components/features/budget-planner/BuddgyProgressDots'
import { BuddgyStepDescribe } from '@/components/features/budget-planner/BuddgyStepDescribe'
import { BuddgyStepConfirm } from '@/components/features/budget-planner/BuddgyStepConfirm'
import { BuddgyStepLifestyle } from '@/components/features/budget-planner/BuddgyStepLifestyle'
import { BuddgyStepSavingsV3 } from '@/components/features/budget-planner/BuddgyStepSavingsV3'
import { BuddgyStepPlan } from '@/components/features/budget-planner/BuddgyStepPlan'
import { BuddgyStepApplied } from '@/components/features/budget-planner/BuddgyStepApplied'

const slide = {
  initial: { x: 80, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -80, opacity: 0 },
  transition: { duration: 0.25, ease: 'easeInOut' as const },
}

export interface BuddgyBuilderFlowProps {
  planId: string
  onClose: () => void
}

/**
 * Buddgy Builder v3 — guided experience container.
 * 6 steps, 2 AI calls, zero chatbot vibes.
 */
export function BuddgyBuilderFlow({ planId, onClose }: BuddgyBuilderFlowProps) {
  const flow = useBuddgyBuilderFlow(planId, onClose)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
      {/* Header: progress dots + close */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <div className="flex-1">
          <BuddgyProgressDots currentIndex={flow.stepIndex} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Step content */}
      <div className="px-5 pt-2 pb-5">
        <AnimatePresence mode="wait">
          <motion.div key={flow.step} {...slide}>
            {flow.step === 'describe' && <BuddgyStepDescribe flow={flow} />}
            {flow.step === 'confirm' && <BuddgyStepConfirm flow={flow} />}
            {flow.step === 'lifestyle' && <BuddgyStepLifestyle flow={flow} />}
            {flow.step === 'savings' && <BuddgyStepSavingsV3 flow={flow} />}
            {flow.step === 'plan' && <BuddgyStepPlan flow={flow} />}
            {flow.step === 'applied' && <BuddgyStepApplied flow={flow} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
