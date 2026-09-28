'use client'

import type { LucideIcon } from 'lucide-react'
import { SlidersHorizontal, PieChart, CreditCard, RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { SelectableCard } from '@/components/ui/SelectableCard'

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
    <div className="flex flex-col gap-2">
      {suggestions.map(({ icon: Icon, label }) => (
        <SelectableCard
          key={label}
          as="action"
          onClick={() => onPickSuggestion(label)}
          className="gap-3 rounded-lg px-3.5 py-3"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{label}</span>
        </SelectableCard>
      ))}
    </div>
  )
}
