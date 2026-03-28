'use client'

import type { RefObject } from 'react'
import { Check } from 'lucide-react'
import { AIChatConfirmationCard } from '@/components/features/ai-chat/AIChatConfirmationCard'
import type { AIChatMessage } from '@/hooks/useAIChat'
import type { Currency } from '@/lib/store/types'

export interface AIChatMessageListProps {
  messages: AIChatMessage[]
  baseCurrency: Currency
  lastUserContentBefore: (assistantMessageId: string) => string | null
  onConfirm: (id: string) => void
  onEdit: (m: AIChatMessage) => void
  scrollAnchorRef: RefObject<HTMLDivElement | null>
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
  scrollAnchorRef,
}: AIChatMessageListProps) {
  return (
    <>
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              message.role === 'user'
                ? 'bg-[var(--color-brand-red)] text-white'
                : 'bg-[var(--color-brand-elevated)] text-white'
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

            {message.confirmed ? (
              <p className="mt-2 text-xs text-[var(--color-brand-green)] flex items-center gap-1">
                <Check className="w-3 h-3" aria-hidden /> Saved!
              </p>
            ) : null}
          </div>
        </div>
      ))}
      <div ref={scrollAnchorRef} />
    </>
  )
}
