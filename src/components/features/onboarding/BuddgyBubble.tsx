'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  buildBuddgyMessage,
  type BuddgyAnswers,
  type BuddgyCardId,
} from '@/lib/onboarding/buddgyScript'

/**
 * Buddgy's chat-style message bubble above an onboarding card.
 *
 * Purely presentational — state (answers, card id) flows in via props.
 * Slides + fades in on mount, stays pinned until the next card changes
 * it. Avatar is a static glyph for v1; a real character drop-in can
 * replace it later without touching the dialogue engine.
 */
export interface BuddgyBubbleProps {
  cardId: BuddgyCardId
  answers: BuddgyAnswers
  className?: string
}

export function BuddgyBubble({ cardId, answers, className }: BuddgyBubbleProps) {
  const t = useT()
  const message = buildBuddgyMessage(cardId, answers, t)
  if (!message) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={cardId}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className={cn('flex items-start gap-3', className)}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-red)]/15 text-[var(--color-brand-red)]">
          <Sparkles className="h-4 w-4" aria-hidden />
        </div>
        <div
          className={cn(
            'relative rounded-2xl rounded-tl-sm border px-4 py-3 text-sm',
            'bg-[var(--color-brand-card)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)]',
          )}
        >
          {message}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
