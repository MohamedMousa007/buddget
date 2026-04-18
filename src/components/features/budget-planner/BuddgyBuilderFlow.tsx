'use client'

import { ChevronLeft, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import type { BuddgyBuilderOpenOptions } from '@/hooks/useBuddgyBuilderFlow'
import { useBuddgyBuilderFlow } from '@/hooks/useBuddgyBuilderFlow'
import { BuddgyProgressDots } from '@/components/features/budget-planner/BuddgyProgressDots'
import { BuddgyStepDescribe } from '@/components/features/budget-planner/BuddgyStepDescribe'
import { BuddgyStepReview } from '@/components/features/budget-planner/BuddgyStepReview'
import { BuddgyStepLifestyle } from '@/components/features/budget-planner/BuddgyStepLifestyle'
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
  builderOptions?: BuddgyBuilderOpenOptions
}

/**
 * Buddgy Builder — guided flow with parse + plan AI calls only.
 */
export function BuddgyBuilderFlow({ planId, onClose, builderOptions }: BuddgyBuilderFlowProps) {
  const flow = useBuddgyBuilderFlow(planId, onClose, builderOptions)

  const showBack = flow.step !== 'describe' && flow.step !== 'applied'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        {showBack ?
          <button
            type="button"
            onClick={flow.goBack}
            className="shrink-0 rounded-lg p-1.5 text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] hover:bg-[var(--color-brand-elevated)] transition-colors"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        : <span className="w-8 shrink-0" aria-hidden />}
        <div className="flex-1 min-w-0">
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

      <div className="px-5 pt-2 pb-5">
        <AnimatePresence mode="wait">
          <motion.div key={flow.step} {...slide}>
            {flow.step === 'describe' && <BuddgyStepDescribe flow={flow} />}
            {flow.step === 'confirm' && <BuddgyStepReview flow={flow} />}
            {flow.step === 'lifestyle' && <BuddgyStepLifestyle flow={flow} />}
            {flow.step === 'plan' && <BuddgyStepPlan flow={flow} />}
            {flow.step === 'applied' && <BuddgyStepApplied flow={flow} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
