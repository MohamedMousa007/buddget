'use client'

import { useMemo } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { BuddgyBuilderApi } from '@/hooks/useBuddgyBuilderFlow'
import { BuddgyLoadingState } from '@/components/features/budget-planner/BuddgyLoadingState'
import { useFinanceStore } from '@/lib/store/useFinanceStore'

/**
 * Step 0: Free-text input — the only typing step.
 *
 * Journey v3 users arrive with city / country / income / household /
 * lifestyle already set. In that case we surface a prominent
 * "Use my info" shortcut that routes via `flow.skipDescribe` and
 * (together with the auto-skip lifestyle logic) jumps straight from
 * here to the plan preview. The free-text input stays as a secondary
 * option for users who want to describe something new (e.g. a life
 * change that isn't reflected on their profile).
 */
export function BuddgyStepDescribe({ flow }: { flow: BuddgyBuilderApi }) {
  // Pull raw strings straight from the store so the selector returns the
  // same reference on unrelated state changes (FX ticks, other edits);
  // trimming happens in a downstream useMemo so no wasted renders.
  const city = useFinanceStore((s) => s.profile.city)
  const country = useFinanceStore((s) => s.profile.country)
  const locationLabel = useMemo(
    () => city?.trim() || country?.trim() || 'local',
    [city, country],
  )
  const canSubmit = flow.describeText.trim().length > 10 && !flow.loading
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
      {flow.hasKnownContext ? (
        <div className="rounded-2xl border border-[var(--color-brand-red)]/30 bg-[var(--color-brand-red)]/5 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-brand-red)] shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">
                I already know about you
              </p>
              <p className="text-xs text-[var(--color-brand-text-secondary)] mt-0.5">
                From your profile and onboarding — income, location, household, lifestyle. Rebuild using those?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={flow.skipDescribe}
            disabled={flow.loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-red)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-brand-red-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Use my info
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <p className="text-sm text-[var(--color-brand-text-primary)]">
        {flow.hasKnownContext
          ? 'Or tell me about a change (new job, new city, saving for something specific):'
          : 'Tell me about your situation.'}
      </p>

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
