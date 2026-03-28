'use client'

import { Bot } from 'lucide-react'

export interface AIChatEmptyStateProps {
  onPickSuggestion: (text: string) => void
}

const SUGGESTIONS = [
  'I spent 45 on lunch via nol silver',
  'Paid mom 2000 EGP',
  'How much have I spent this month?',
]

/**
 * Shown when the thread has no messages yet.
 */
export function AIChatEmptyState({ onPickSuggestion }: AIChatEmptyStateProps) {
  return (
    <div className="text-center py-8">
      <Bot className="w-10 h-10 text-[var(--color-brand-text-muted)] mx-auto mb-3" aria-hidden />
      <p className="text-sm text-[var(--color-brand-text-secondary)]">
        Hi! I can help you add expenses, check your budget, or record debt payments.
      </p>
      <div className="mt-4 space-y-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPickSuggestion(suggestion)}
            className="block w-full text-left px-3 py-2 rounded-lg bg-[var(--color-brand-elevated)] text-xs text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)] transition-colors"
          >
            &ldquo;{suggestion}&rdquo;
          </button>
        ))}
      </div>
    </div>
  )
}
