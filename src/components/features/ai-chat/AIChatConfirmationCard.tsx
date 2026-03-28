'use client'

import { Check, Pencil } from 'lucide-react'
import { looksLikeMultipleIntents } from '@/lib/ai/aiActionHandlers'
import { AIChatActionPreview } from '@/components/features/ai-chat/AIChatActionPreview'
import type { AIChatMessage } from '@/hooks/useAIChat'
import type { Currency } from '@/lib/store/types'

export interface AIChatConfirmationCardProps {
  message: AIChatMessage
  priorUserText: string | null
  baseCurrency: Currency
  onConfirm: (messageId: string) => void
  onEdit: (message: AIChatMessage) => void
}

/**
 * Confirm / edit bar for structured assistant actions (non-query).
 */
export function AIChatConfirmationCard({
  message,
  priorUserText,
  baseCurrency,
  onConfirm,
  onEdit,
}: AIChatConfirmationCardProps) {
  if (!message.aiResponse || message.confirmed) return null

  const toShow = message.aiResponse.actions.filter(
    (a) => a.action !== 'query' && a.action !== 'unclear'
  )
  if (toShow.length === 0) return null

  const multiIntentHint =
    toShow.length === 1 && priorUserText && looksLikeMultipleIntents(priorUserText)

  return (
    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
      {multiIntentHint ? (
        <p className="text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1.5">
          Your message looks like several requests. If something is missing after you save, try one item per message or
          confirm again after editing.
        </p>
      ) : null}
      {toShow.map((item, idx) => {
        const d = item.data as Record<string, unknown>
        return (
          <div
            key={idx}
            className="text-xs space-y-1 text-white/80 pb-2 border-b border-white/5 last:border-0 last:pb-0"
          >
            <AIChatActionPreview action={item.action} data={d} baseCurrency={baseCurrency} />
          </div>
        )
      })}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onConfirm(message.id)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-brand-green)] text-white text-xs font-medium"
        >
          <Check className="w-3 h-3" />
          Confirm & Save
        </button>
        <button
          type="button"
          onClick={() => onEdit(message)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--color-brand-elevated)] text-white text-xs font-medium border border-white/10"
        >
          <Pencil className="w-3 h-3" />
          Edit
        </button>
      </div>
    </div>
  )
}
