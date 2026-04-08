'use client'

import { Loader2 } from 'lucide-react'
import { parseBuddgyAmountInput } from '@/lib/budget/buddgyAmountInput'
import type { BuddgyFlowApi } from '@/hooks/useBuddgyFlow'
import { BuddgyStepBack } from '@/components/features/budget-planner/BuddgyStepBack'
import { BuddgyWizardDots } from '@/components/features/budget-planner/BuddgyWizardDots'

const ghostRebuildClass =
  'cursor-pointer rounded-xl border border-[var(--color-brand-border)] bg-transparent px-5 py-2.5 text-sm font-semibold text-[var(--color-brand-text-secondary)] hover:text-white hover:border-[var(--color-brand-text-muted)] transition-colors'

const primaryNextClass =
  'cursor-pointer rounded-xl bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2'

/**
 * Back/Next (or summary actions) + optional dots at the top of the wizard card.
 */
export function BuddgyStepTopBar({ flow }: { flow: BuddgyFlowApi }) {
  const { step, dotsUnlocked } = flow

  const rowClass = 'flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center'

  if (step === 'summary') {
    return (
      <div className="space-y-3 border-b border-[#2A2A38] pb-4 mb-4">
        <div className={rowClass}>
          <button type="button" onClick={() => flow.restartGuidedWizard()} className={ghostRebuildClass}>
            Rebuild with Buddgy
          </button>
          <button type="button" onClick={() => flow.finishFlow()} className={primaryNextClass}>
            Done
          </button>
        </div>
        {dotsUnlocked ? <BuddgyWizardDots flow={flow} /> : null}
      </div>
    )
  }

  if (step === 'income') {
    return (
      <div className="space-y-3 border-b border-[#2A2A38] pb-4 mb-4">
        <div className={rowClass}>
          <BuddgyStepBack flow={flow} />
          <button
            type="button"
            onClick={() => {
              const n = parseBuddgyAmountInput(flow.incomeAmount)
              flow.ensureIncome(n, flow.incomeCurrency)
              flow.advanceFromStep('income')
            }}
            className={primaryNextClass}
          >
            Next →
          </button>
        </div>
        {dotsUnlocked ? <BuddgyWizardDots flow={flow} /> : null}
      </div>
    )
  }

  if (step === 'household' || step === 'transportMode') {
    return (
      <div className="space-y-3 border-b border-[#2A2A38] pb-4 mb-4">
        <div className={rowClass}>
          <BuddgyStepBack flow={flow} />
        </div>
        {dotsUnlocked ? <BuddgyWizardDots flow={flow} /> : null}
      </div>
    )
  }

  if (step === 'rent') {
    return (
      <div className="space-y-3 border-b border-[#2A2A38] pb-4 mb-4">
        <div className={rowClass}>
          <BuddgyStepBack flow={flow} />
          <button
            type="button"
            onClick={() => {
              flow.saveRent()
              flow.advanceFromStep('rent')
            }}
            className={primaryNextClass}
          >
            Next →
          </button>
        </div>
        {dotsUnlocked ? <BuddgyWizardDots flow={flow} /> : null}
      </div>
    )
  }

  if (step === 'dewa') {
    return (
      <div className="space-y-3 border-b border-[#2A2A38] pb-4 mb-4">
        <div className={rowClass}>
          <BuddgyStepBack flow={flow} />
          <button
            type="button"
            onClick={() => {
              flow.saveDewa()
              flow.advanceFromStep('dewa')
            }}
            className={primaryNextClass}
          >
            Next →
          </button>
        </div>
        {dotsUnlocked ? <BuddgyWizardDots flow={flow} /> : null}
      </div>
    )
  }

  if (step === 'transportDetail') {
    return (
      <div className="space-y-3 border-b border-[#2A2A38] pb-4 mb-4">
        <div className={rowClass}>
          <BuddgyStepBack flow={flow} />
          <button
            type="button"
            onClick={() => {
              flow.saveTransportFromDetail()
              flow.advanceFromStep('transportDetail')
            }}
            className={primaryNextClass}
          >
            Next →
          </button>
        </div>
        {dotsUnlocked ? <BuddgyWizardDots flow={flow} /> : null}
      </div>
    )
  }

  if (step === 'savings') {
    return (
      <div className="space-y-3 border-b border-[#2A2A38] pb-4 mb-4">
        <div className={rowClass}>
          <BuddgyStepBack flow={flow} />
          <button
            type="button"
            disabled={flow.savingsNextLoading}
            onClick={() => void flow.onSavingsNext()}
            className={primaryNextClass}
          >
            {flow.savingsNextLoading ?
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Loading...</span>
              </>
            : 'Next →'}
          </button>
        </div>
        {dotsUnlocked ? <BuddgyWizardDots flow={flow} /> : null}
      </div>
    )
  }

  return null
}
