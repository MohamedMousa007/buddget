'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useBuddgyFlow, type UseBuddgyFlowOptions } from '@/hooks/useBuddgyFlow'
import { BuddgyProgressBar } from '@/components/features/budget-planner/BuddgyProgressBar'
import { BuddgySaveFlash } from '@/components/features/budget-planner/BuddgySaveFlash'
import { BuddgyStepIncome } from '@/components/features/budget-planner/BuddgyStepIncome'
import { BuddgyStepHousehold } from '@/components/features/budget-planner/BuddgyStepHousehold'
import { BuddgyStepRent } from '@/components/features/budget-planner/BuddgyStepRent'
import { BuddgyStepDewa } from '@/components/features/budget-planner/BuddgyStepDewa'
import { BuddgyStepTransportMode } from '@/components/features/budget-planner/BuddgyStepTransportMode'
import { BuddgyStepTransportDetail } from '@/components/features/budget-planner/BuddgyStepTransportDetail'
import { BuddgyStepSavings } from '@/components/features/budget-planner/BuddgyStepSavings'
import { BuddgyStepSummary } from '@/components/features/budget-planner/BuddgyStepSummary'

const slide = {
  initial: { x: 100, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -100, opacity: 0 },
  transition: { duration: 0.3, ease: 'easeInOut' as const },
}

export interface BuddgyFlowProps {
  planId: string
  mode?: UseBuddgyFlowOptions['mode']
  onClose: () => void
  /** Clears guided state and remounts flow at step 1 (summary actions). */
  onRestartWizard?: () => void
}

/**
 * Inline Buddgy guided budget setup: step cards with slide transitions and store writes.
 */
export function BuddgyFlow({ planId, mode = 'resume', onClose, onRestartWizard }: BuddgyFlowProps) {
  const flow = useBuddgyFlow(planId, {
    mode,
    onFlowComplete: onClose,
    onRestartWizard,
  })

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
      <BuddgySaveFlash show={flow.showFlash} />
      <div className="p-1">
        <BuddgyProgressBar progress={flow.progress} />
      </div>
      <div className="px-4 pt-3 pb-5">
        <AnimatePresence mode="wait">
          <motion.div key={flow.step} {...slide}>
            {flow.step === 'income' ?
              <BuddgyStepIncome flow={flow} />
            : flow.step === 'household' ?
              <BuddgyStepHousehold flow={flow} />
            : flow.step === 'rent' ?
              <BuddgyStepRent flow={flow} />
            : flow.step === 'dewa' ?
              <BuddgyStepDewa flow={flow} />
            : flow.step === 'transportMode' ?
              <BuddgyStepTransportMode flow={flow} />
            : flow.step === 'transportDetail' ?
              <BuddgyStepTransportDetail flow={flow} />
            : flow.step === 'savings' ?
              <BuddgyStepSavings flow={flow} />
            : flow.step === 'summary' ?
              <BuddgyStepSummary flow={flow} />
            : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
