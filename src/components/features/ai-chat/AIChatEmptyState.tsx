'use client'

import type { LucideIcon } from 'lucide-react'
import { SlidersHorizontal, PieChart, CreditCard, RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n'

export interface AIChatEmptyStateProps {
  onPickSuggestion: (text: string) => void
}

/**
 * Shown when the thread has no messages yet — four red-chip suggestion rows.
 */
export function AIChatEmptyState({ onPickSuggestion }: AIChatEmptyStateProps) {
  const t = useT()
  const suggestions: { icon: LucideIcon; label: string }[] = [
    { icon: SlidersHorizontal, label: t.ai.suggestion1 },
    { icon: PieChart, label: t.ai.suggestion2 },
    { icon: CreditCard, label: t.ai.suggestion3 },
    { icon: RefreshCw, label: t.ai.suggestion4 },
  ]

  return (
    <div className="flex flex-col gap-[7px]">
      {suggestions.map(({ icon: Icon, label }) => (
        <button
          key={label}
          type="button"
          onClick={() => onPickSuggestion(label)}
          className="flex w-full items-center gap-[11px] rounded-[13px] border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-[13px] py-[11px] text-start transition-colors hover:bg-[var(--color-brand-border)]/40"
        >
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[rgba(229,9,20,0.13)] text-[var(--color-brand-red)]">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-[13.5px] font-semibold text-[var(--color-brand-text-primary)]">{label}</span>
        </button>
      ))}
    </div>
  )
}
