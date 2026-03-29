'use client'

import { Bot, X } from 'lucide-react'
import { useT } from '@/lib/i18n'

export interface AIChatHeaderProps {
  onClose: () => void
}

/**
 * Title row for the AI assistant sheet.
 */
export function AIChatHeader({ onClose }: AIChatHeaderProps) {
  const t = useT()
  return (
    <div className="flex items-center justify-between p-4 border-b border-[var(--color-brand-border)]">
      <div className="flex items-center gap-2">
        <Bot className="w-5 h-5 text-[var(--color-brand-red)]" aria-hidden />
        <h3 id="ai-chat-title" className="text-sm font-semibold text-white">
          {t.ai.headerTitle}
        </h3>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-lg hover:bg-[var(--color-brand-elevated)] transition-colors"
        aria-label="Close chat"
      >
        <X className="w-5 h-5 text-[var(--color-brand-text-muted)]" />
      </button>
    </div>
  )
}
