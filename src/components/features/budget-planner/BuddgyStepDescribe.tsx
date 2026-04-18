'use client'

import { ArrowRight } from 'lucide-react'
import type { BuddgyBuilderApi } from '@/hooks/useBuddgyBuilderFlow'
import { BuddgyLoadingState } from '@/components/features/budget-planner/BuddgyLoadingState'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/**
 * Step 0: Free-text input — the only typing step.
 */
export function BuddgyStepDescribe({ flow }: { flow: BuddgyBuilderApi }) {
  const profileCity = useFinanceStore((s) => s.profile.city?.trim() || '')
  const profileCountry = useFinanceStore((s) => s.profile.country?.trim() || '')
  const canSubmit = flow.describeText.trim().length > 10 && !flow.loading

  const locationLabel = profileCity || profileCountry || 'local'
  const parseMessages = [
    'Reading your details…',
    `Checking ${locationLabel} costs…`,
    'Crunching numbers…',
  ]

  if (flow.loading && flow.loadingKind === 'parse') {
    return <BuddgyLoadingState messages={parseMessages} intervalMs={2000} />
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-brand-text-primary)]">Tell me about your situation.</p>

      <textarea
        value={flow.describeText}
        onChange={(e) => flow.setDescribeText(e.target.value)}
        placeholder="Describe your income, living situation, and financial goals…"
        rows={4}
        className="w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 py-3 text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-red)]/40 resize-none"
        disabled={flow.loading}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
            e.preventDefault()
            void flow.submitDescription(flow.describeText.trim())
          }
        }}
      />

      {flow.error && <p className="text-xs text-[var(--color-brand-red)]">{flow.error}</p>}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={flow.skipDescribe}
          disabled={flow.loading}
          className="text-xs text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)] disabled:opacity-40"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => void flow.submitDescription(flow.describeText.trim())}
          disabled={!canSubmit}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
