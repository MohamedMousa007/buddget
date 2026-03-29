'use client'

import { Bot } from 'lucide-react'
import { useT } from '@/lib/i18n'

export interface AIChatEmptyStateProps {
  onPickSuggestion: (text: string) => void
}

/**
 * Shown when the thread has no messages yet.
 */
export function AIChatEmptyState({ onPickSuggestion }: AIChatEmptyStateProps) {
  const t = useT()
  const suggestions = [t.ai.suggestion1, t.ai.suggestion2, t.ai.suggestion3]

  return (
    <div className="text-center py-8">
      <Bot className="w-10 h-10 text-[var(--color-brand-text-muted)] mx-auto mb-3" aria-hidden />
      <p className="text-sm text-[var(--color-brand-text-secondary)] whitespace-pre-line">
        {t.ai.emptyIntro}
      </p>
      <div className="mt-4 space-y-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPickSuggestion(suggestion)}
            className="block w-full text-start px-3 py-2 rounded-lg bg-[var(--color-brand-elevated)] text-xs text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-border)] transition-colors"
          >
            &ldquo;{suggestion}&rdquo;
          </button>
        ))}
      </div>
    </div>
  )
}
