'use client'

import { Bot } from 'lucide-react'

export interface AIChatEmptyStateProps {
  onPickSuggestion: (text: string) => void
}

const SUGGESTIONS = [
  "Try: 'Spent 45 on lunch with Silver Nol'",
  "Try: 'Paid 2000 EGP toward Mom\u2019s balance'",
  "Try: 'How much have I spent on food this month?'",
]

/**
 * Shown when the thread has no messages yet.
 */
export function AIChatEmptyState({ onPickSuggestion }: AIChatEmptyStateProps) {
  return (
    <div className="text-center py-8">
      <Bot className="w-10 h-10 text-[var(--color-brand-text-muted)] mx-auto mb-3" aria-hidden />
      <p className="text-sm text-[var(--color-brand-text-secondary)]">
        Hi there! I&apos;m your money assistant 🤖{'\n'}Tell me what you spent, earned, or want to track and I&apos;ll take care of the rest.
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
