'use client'

import { X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { BuddgyIcon } from '@/components/ai/BuddgyIcon'
import { useBuddgyMood } from '@/lib/ai/useBuddgyMood'
import { IconButton } from '@/components/ui/IconButton'

export interface AIChatHeaderProps {
  onClose: () => void
}

/**
 * Title row for the AI assistant sheet — Buddgy avatar + title/subtitle.
 *
 * The avatar shows the live mood, so the header answers "is it working?" without
 * a separate spinner. Handoff §9: 20px icon in a 36px container.
 */
export function AIChatHeader({ onClose }: AIChatHeaderProps) {
  const t = useT()
  const mood = useBuddgyMood()
  return (
    <div className="flex items-center gap-3 p-4 border-b border-[var(--color-brand-border)]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-text)]">
        <BuddgyIcon mood={mood} size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 id="ai-chat-title" className="text-lg font-extrabold text-[var(--color-brand-text-primary)]">
          {t.ai.headerTitle}
        </h3>
        <p className="text-xs text-[var(--color-brand-text-muted)] truncate">{t.ai.headerSubtitle}</p>
      </div>
      <IconButton
        onClick={onClose}
        aria-label="Close chat"
        variant="tinted"
        size="sm"
        shape="round"
      >
        <X className="h-4 w-4" strokeWidth={2.2} />
      </IconButton>
    </div>
  )
}
