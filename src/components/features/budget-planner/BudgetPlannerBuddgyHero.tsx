'use client'

import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BudgetPlannerBuddgyHeroLabels {
  title: string
  subtitle: string
  body: string
  cta: string
  manualHint: string
  compactTitle: string
  compactBody: string
  compactCta: string
}

export interface BudgetPlannerBuddgyHeroProps {
  variant: 'primary' | 'compact'
  labels: BudgetPlannerBuddgyHeroLabels
  onStartBuilder: () => void
  disabled?: boolean
}

/** Prominent CTA to launch Buddgy’s guided budget plan builder. */
export function BudgetPlannerBuddgyHero({
  variant,
  labels,
  onStartBuilder,
  disabled,
}: BudgetPlannerBuddgyHeroProps) {
  if (variant === 'compact') {
    return (
      <div className="rounded-2xl border border-[var(--color-brand-border)] bg-[#111118] p-4 space-y-2">
        <p className="text-sm font-semibold text-white">{labels.compactTitle}</p>
        <p className="text-xs text-[var(--color-brand-text-muted)] leading-relaxed">{labels.compactBody}</p>
        <button
          type="button"
          disabled={disabled}
          onClick={onStartBuilder}
          className={cn(
            'w-full cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors',
            'bg-[var(--color-brand-elevated)] border border-[var(--color-brand-border)] hover:bg-[#2A2A38]',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {labels.compactCta}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--color-brand-border)] bg-gradient-to-br from-[#111118] to-[#1A1A24] p-6 space-y-4 shadow-lg">
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden>
          🤖
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-brand-red)]">
            {labels.subtitle}
          </p>
          <h2 className="text-lg font-bold text-white leading-snug">{labels.title}</h2>
          <p className="text-sm text-[var(--color-brand-text-secondary)] leading-relaxed">{labels.body}</p>
        </div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onStartBuilder}
        className={cn(
          'flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold text-white transition-colors',
          'bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover,#c40812)]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
        {labels.cta}
      </button>
      <p className="text-center text-xs text-[var(--color-brand-text-muted)]">{labels.manualHint}</p>
    </div>
  )
}
