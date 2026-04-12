'use client'

import { Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useT } from '@/lib/i18n'

export interface AIChatComposerProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled: boolean
}

/**
 * Message input + send for the assistant modal.
 */
export function AIChatComposer({ value, onChange, onSend, disabled }: AIChatComposerProps) {
  const t = useT()
  return (
    <div className="p-4 border-t border-[var(--color-brand-border)]">
      <div className="flex gap-2">
        <Input
          placeholder={t.ai.composerPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          className="flex-1 bg-[var(--color-brand-elevated)] border-[var(--color-brand-border)] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)] text-sm"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!value.trim() || disabled}
          className="p-2.5 rounded-lg bg-[var(--color-brand-red)] hover:bg-[var(--color-brand-red-hover)] text-white transition-colors disabled:opacity-50"
          aria-label={t.ai.sendMessage}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
