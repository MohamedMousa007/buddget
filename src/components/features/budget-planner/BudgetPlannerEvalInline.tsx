'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { BudgetPlanEvalRating } from '@/lib/ai/budgetPlannerAi'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const PREVIEW_LEN = 80

function presentationForRating(rating: BudgetPlanEvalRating, t: ReturnType<typeof useT>) {
  switch (rating) {
    case 'Realistic':
      return {
        dot: 'bg-[#1DB954]',
        labelClass: 'text-[#1DB954]',
        label: t.budgetPlanner.aiEvalStatusGood,
        tip: t.budgetPlanner.aiEvalTipGood,
      }
    case 'Tight':
      return {
        dot: 'bg-[#FF9F0A]',
        labelClass: 'text-[#FF9F0A]',
        label: t.budgetPlanner.aiEvalStatusNeedsAdjustment,
        tip: t.budgetPlanner.aiEvalTipTight,
      }
    case 'Needs Adjustment':
    case 'Unrealistic':
      return {
        dot: 'bg-[#E50914]',
        labelClass: 'text-[#E50914]',
        label: t.budgetPlanner.aiEvalStatusUnrealistic,
        tip: t.budgetPlanner.aiEvalTipUnrealistic,
      }
    default: {
      return {
        dot: 'bg-[#1DB954]',
        labelClass: 'text-[#1DB954]',
        label: t.budgetPlanner.aiEvalStatusGood,
        tip: t.budgetPlanner.aiEvalTipGood,
      }
    }
  }
}

export interface BudgetPlannerEvalInlineProps {
  loading: boolean
  error: string | null
  rating: BudgetPlanEvalRating | null
  explanation: string | null
}

/** Compact AI plan rating under the categories title; tap to expand details. */
export function BudgetPlannerEvalInline({ loading, error, rating, explanation }: BudgetPlannerEvalInlineProps) {
  const t = useT()
  const [open, setOpen] = useState(false)

  if (loading) {
    return (
      <p className="text-xs text-[var(--color-brand-text-muted)] animate-pulse">{t.budgetPlanner.aiEvalLoading}</p>
    )
  }

  if (error) {
    return <p className="text-xs text-[var(--color-brand-amber)]">{error}</p>
  }

  if (!rating || !explanation) {
    return (
      <p className="text-xs text-[var(--color-brand-text-muted)] animate-pulse">{t.budgetPlanner.aiEvalLoading}</p>
    )
  }

  const pres = presentationForRating(rating, t)
  const preview =
    explanation.length > PREVIEW_LEN ? `${explanation.slice(0, PREVIEW_LEN).trim()}…` : explanation

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer flex-col items-start gap-1 text-left sm:flex-row sm:items-center sm:gap-2"
        aria-expanded={open}
        aria-label={t.budgetPlanner.aiEvalExpandAria}
      >
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', pres.dot)} aria-hidden />
          <span className={cn('text-sm font-semibold', pres.labelClass)}>{pres.label}</span>
        </div>
        <span className="line-clamp-2 text-xs text-[var(--color-brand-text-muted)] sm:line-clamp-1 sm:flex-1">
          {preview}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            layout
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2 rounded-lg bg-[var(--color-brand-elevated)] p-3">
              <p className="text-sm leading-relaxed text-[var(--color-brand-text-secondary)] whitespace-pre-line">
                {explanation}
              </p>
              <p className="text-xs text-[var(--color-brand-text-muted)]">
                <span className="font-semibold text-[var(--color-brand-text-secondary)]">
                  {t.budgetPlanner.aiEvalSuggestionLabel}
                </span>{' '}
                {pres.tip}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
