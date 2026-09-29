'use client'

import { BuddgyIcon } from '@/components/ai/BuddgyIcon'

/** Buddgy thinking while the assistant request is in flight. */
export function AIChatTypingIndicator() {
  return (
    <div className="flex items-end gap-2 justify-start text-[var(--color-brand-text)]" aria-busy>
      <BuddgyIcon mood="thinking" size={26} strokeWidth={1.75} filled alive />
      <div className="bg-[var(--color-brand-elevated)] rounded-2xl px-4 py-3">
        <div className="flex gap-1">
          {[0, 150, 300].map((d) => (
            <span
              key={d}
              className="w-2 h-2 bg-[var(--color-brand-text-muted)] rounded-full animate-bounce"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
