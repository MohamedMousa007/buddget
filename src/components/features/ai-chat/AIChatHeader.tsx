'use client'

import { X } from 'lucide-react'
import { useT } from '@/lib/i18n'

export interface AIChatHeaderProps {
  onClose: () => void
}

/**
 * Title row for the AI assistant sheet — Buddgy mascot chip + title/subtitle.
 */
export function AIChatHeader({ onClose }: AIChatHeaderProps) {
  const t = useT()
  return (
    <div className="flex items-center gap-3 p-4 border-b border-[var(--color-brand-border)]">
      <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center overflow-hidden rounded-[13px] border border-[rgba(229,9,20,0.45)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/buddgy/buddgy-square.png" alt="" className="h-full w-full object-cover" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h3 id="ai-chat-title" className="text-[17px] font-extrabold text-[var(--color-brand-text-primary)]">
          {t.ai.headerTitle}
        </h3>
        <p className="text-[11.5px] text-[var(--color-brand-text-muted)] truncate">{t.ai.headerSubtitle}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex h-11 w-11 shrink-0 items-center justify-center"
        aria-label="Close chat"
      >
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-secondary)]">
          <X className="h-4 w-4" strokeWidth={2.2} />
        </span>
      </button>
    </div>
  )
}
