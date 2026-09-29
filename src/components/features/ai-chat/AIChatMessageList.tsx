'use client'

import { Check } from 'lucide-react'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { AIChatConfirmationCard } from '@/components/features/ai-chat/AIChatConfirmationCard'
import type { AIChatMessage } from '@/hooks/useAIChat'
import { useT } from '@/lib/i18n'
import type { Currency } from '@/lib/store/types'

export interface AIChatMessageListProps {
  messages: AIChatMessage[]
  baseCurrency: Currency
  lastUserContentBefore: (assistantMessageId: string) => string | null
  onConfirm: (id: string) => void
  onEdit: (m: AIChatMessage) => void
}

/**
 * Scrollable transcript of user and assistant bubbles.
 */
export function AIChatMessageList({
  messages,
  baseCurrency,
  lastUserContentBefore,
  onConfirm,
  onEdit,
}: AIChatMessageListProps) {
  const t = useT()
  return (
    <>
      {messages.map((message, i) => (
        <div
          key={message.id}
          className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {message.role === 'assistant' ? (
            // Only the newest reply is animated; older faces stay still so the thread isn't busy.
            <span className="mb-0.5 shrink-0 text-[var(--color-brand-text)]">
              <BuddgyIcon mood={message.mood ?? 'awake'} size={26} strokeWidth={1.75} filled animated={i === messages.length - 1} />
            </span>
          ) : null}
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              message.role === 'user'
                ? 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)]'
                : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)]'
            }`}
          >
            <p className={message.role === 'assistant' ? 'whitespace-pre-line' : undefined}>{message.content}</p>

            <AIChatConfirmationCard
              message={message}
              priorUserText={lastUserContentBefore(message.id)}
              baseCurrency={baseCurrency}
              onConfirm={onConfirm}
              onEdit={onEdit}
            />

            {message.aiResponse?.notes?.map((note) => (
              <p key={note} className="mt-2 text-xs text-[var(--color-brand-text-muted)]">{t.buddgy.remembered(note)}</p>
            ))}

            {message.confirmed ? (
              <p className="mt-2 text-xs text-[var(--color-brand-green)] flex items-center gap-1">
                <Check className="w-3 h-3" aria-hidden /> {t.ai.confirmedLabel}
              </p>
            ) : null}
          </div>
        </div>
      ))}
    </>
  )
}
