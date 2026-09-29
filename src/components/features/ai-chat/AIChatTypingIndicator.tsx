'use client'

import { BuddgyIcon } from '@/components/ai/BuddgyIcon'

/**
 * Buddgy's in-flight reply: thinking dots until the first words arrive, then the
 * words themselves as they stream, with Buddgy talking.
 */
export function AIChatTypingIndicator({ text }: { text?: string | null }) {
  return (
    <div className="flex items-end gap-2 justify-start text-[var(--color-brand-text)]" aria-busy>
      <BuddgyIcon mood={text ? 'talking' : 'thinking'} size={26} strokeWidth={1.75} filled alive />
      <div className="max-w-[85%] bg-[var(--color-brand-elevated)] rounded-2xl px-4 py-2.5 text-sm text-[var(--color-brand-text-primary)]">
        {text ? (
          <p className="whitespace-pre-line">{text}</p>
        ) : (
          <div className="flex gap-1 py-0.5">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="w-2 h-2 bg-[var(--color-brand-text-muted)] rounded-full animate-bounce"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
