'use client'

import { Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useT } from '@/lib/i18n'
import { IconButton } from '@/components/ui/IconButton'

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
        <IconButton
          onClick={onSend}
          disabled={!value.trim() || disabled}
          aria-label={t.ai.sendMessage}
          size="sm"
          className="shrink-0"
        >
          <Send className="w-5 h-5" />
        </IconButton>
      </div>
    </div>
  )
}
