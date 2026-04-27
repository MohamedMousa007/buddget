'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  buildBuddgyMessage,
  type BuddgyAnswers,
  type BuddgyCardId,
} from '@/lib/onboarding/buddgyScript'
import { BuddgyAvatar, type BuddgyPose } from '@/components/illustrations/BuddgyAvatar'

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

  const pose = poseForCard(cardId)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={cardId}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        className={cn(
          'flex flex-col items-center text-center gap-3 sm:gap-4',
          className,
        )}
      >
        <BuddgyAvatar pose={pose} size="md" />
        <p className="max-w-md text-base sm:text-lg leading-relaxed text-[var(--color-brand-text-primary)]">
          {message}
        </p>
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Map a card id to a Buddgy pose so the avatar's expression tracks
 * what Buddgy is saying. Falls back to `greeting` for anything
 * unspecified.
 */
function poseForCard(cardId: BuddgyCardId): BuddgyPose {
  switch (cardId) {
    case 'welcomeIntro':
    case 'identityName':
      return 'greeting'
    case 'generateIntro':
      return 'thinking'
    case 'gateDebts':
    case 'gateSubscriptions':
    case 'gateSavings':
      return 'pointing'
    case 'goalsIntro':
      return 'celebrating'
    default:
      return 'greeting'
  }
}
