'use client'

import { Sparkles } from 'lucide-react'
import type { BudgetPlanEvalRating } from '@/lib/ai/budgetPlannerAi'

export interface BudgetPlannerAiEvalCardProps {
  rating: BudgetPlanEvalRating | null
  explanation: string | null
  loading: boolean
  error: string | null
  labels: { title: string; loading: string; error: string }
}

function ratingStyle(r: BudgetPlanEvalRating): string {
  if (r === 'Tight') return 'text-[var(--color-brand-amber)]'
  if (r === 'Needs Adjustment') return 'text-[var(--color-brand-red)]'
  return 'text-[var(--color-brand-green)]'
}

/** AI rating + explanation for the active plan. */
export function BudgetPlannerAiEvalCard({ rating, explanation, loading, error, labels }: BudgetPlannerAiEvalCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-[var(--color-brand-red)]" />
        <h2 className="text-sm font-medium text-[var(--color-brand-text-secondary)] uppercase tracking-wider">
          {labels.title}
        </h2>
      </div>
      {loading ? (
        <p className="text-sm text-[var(--color-brand-text-muted)] animate-pulse">{labels.loading}</p>
      ) : error ? (
        <p className="text-sm text-[var(--color-brand-amber)]">{error}</p>
      ) : rating && explanation ? (
        <div className="space-y-2">
          <p className={`text-base font-semibold ${ratingStyle(rating)}`}>{rating}</p>
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed whitespace-pre-line">
            {explanation}
          </p>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-brand-text-muted)]">{labels.error}</p>
      )}
    </div>
  )
}
