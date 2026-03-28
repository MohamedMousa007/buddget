'use client'

/**
 * Three-dot loading state while the assistant request is in flight.
 */
export function AIChatTypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--color-brand-elevated)] rounded-2xl px-4 py-3" aria-busy>
        <div className="flex gap-1">
          <span
            className="w-2 h-2 bg-[var(--color-brand-text-muted)] rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 bg-[var(--color-brand-text-muted)] rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 bg-[var(--color-brand-text-muted)] rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  )
}
