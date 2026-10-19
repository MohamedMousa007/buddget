'use client'

import { useEffect, useRef, useState } from 'react'
import { SquarePen, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { BuddgyIcon, type BuddgyMood } from '@/components/ai/BuddgyIcon'
import { useBuddgyMood } from '@/lib/ai/useBuddgyMood'
import { IconButton } from '@/components/ui/IconButton'
import type { BuddgyBeat } from '@/lib/buddgy/client/chatTypes'
import { useBuddgyChatCopy } from '@/lib/i18n/buddgyChatCopy'

export interface AIChatHeaderProps {
  onClose: () => void
  onNewChat: () => void
  /** A thread exists to start over from. */
  canReset: boolean
  beat: BuddgyBeat | null
  isLoading: boolean
  /** The reply is being written out right now. */
  streaming: boolean
}

const TALK_MS = 1100
const HOLD_MS = 3800
const REACTION: Partial<Record<BuddgyMood, string>> = {
  happy: 'bg-react-jump', done: 'bg-react-jump', wink: 'bg-react-spin',
  worried: 'bg-react-shake', error: 'bg-react-shake',
}

/**
 * Buddgy's face through a reply: thinking while the request runs, "talking" as
 * the answer lands, then the feeling of that answer (worried about overspend,
 * happy about a saved entry…) before settling back to awake.
 */
function useBeatMood(beat: BuddgyBeat | null, isLoading: boolean, streaming: boolean): BuddgyMood {
  // The stage belongs to one beat; a newer beat starts from its first stage.
  const [stage, setStage] = useState<{ at: number; phase: 'hold' | 'rest' }>({ at: 0, phase: 'rest' })
  useEffect(() => {
    if (!beat) return
    const a = window.setTimeout(() => setStage({ at: beat.at, phase: 'hold' }), TALK_MS)
    const b = window.setTimeout(() => setStage({ at: beat.at, phase: 'rest' }), TALK_MS + HOLD_MS)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [beat])
  if (streaming) return 'talking'
  if (isLoading) return 'thinking'
  if (!beat) return 'awake'
  const silent = beat.mood === 'done' || beat.mood === 'error'
  const phase = stage.at === beat.at ? stage.phase : silent ? 'hold' : 'talk'
  if (phase === 'rest') return 'awake'
  return phase === 'talk' ? 'talking' : beat.mood
}

/** Title row for the AI assistant sheet — a live Buddgy avatar + title. */
export function AIChatHeader({ onClose, onNewChat, canReset, beat, isLoading, streaming }: AIChatHeaderProps) {
  const t = useT()
  const copy = useBuddgyChatCopy()
  const surface = useBuddgyMood()
  const chatMood = useBeatMood(beat, isLoading, streaming)
  const mood = surface === 'offline' ? 'offline' : chatMood
  const avatarRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const cls = mood !== 'talking' && REACTION[mood]
    const el = avatarRef.current
    if (!cls || !el) return
    el.classList.remove(cls)
    void el.offsetWidth
    el.classList.add(cls)
  }, [mood])

  return (
    <div className="flex items-center gap-3 p-4 border-b border-[var(--color-brand-border)]">
      <span ref={avatarRef} className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--color-brand-text)]">
        <BuddgyIcon mood={mood} size={40} strokeWidth={1.75} filled alive />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 id="ai-chat-title" className="text-lg font-extrabold text-[var(--color-brand-text-primary)]">
          {t.ai.headerTitle}
        </h3>
        <p className="text-xs text-[var(--color-brand-text-muted)] truncate" aria-live="polite">
          {isLoading && !streaming ? t.buddgy.thinking : t.ai.headerSubtitle}
        </p>
      </div>
      {canReset ? (
        <IconButton onClick={onNewChat} aria-label={copy.newChat} variant="tinted" size="sm" shape="round">
          <SquarePen className="h-4 w-4" strokeWidth={2.2} />
        </IconButton>
      ) : null}
      <IconButton
        onClick={onClose}
        aria-label={copy.close}
        variant="tinted"
        size="sm"
        shape="round"
      >
        <X className="h-4 w-4" strokeWidth={2.2} />
      </IconButton>
    </div>
  )
}
