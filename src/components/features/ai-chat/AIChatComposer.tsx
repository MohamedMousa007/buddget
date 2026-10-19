'use client'

import { Send, Square } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { Textarea } from '@/components/ui/textarea'
import { useBuddgyChatCopy } from '@/lib/i18n/buddgyChatCopy'
import { QuotaWheel } from '@/components/features/ai-chat/QuotaWheel'

export interface AIChatComposerProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  onStop: () => void
  busy: boolean
  placeholder?: string
  /** Changes when the wheel should re-read usage: a turn finished, a new chat began. */
  usageKey: string
}

/** Message box: Enter sends, Shift+Enter breaks the line, and it never fires mid-IME-composition. */
export function AIChatComposer({ value, onChange, onSend, onStop, busy, placeholder, usageKey }: AIChatComposerProps) {
  const copy = useBuddgyChatCopy()
  return (
    <div className="border-t border-[var(--color-brand-border)] p-3">
      <div className="flex items-end gap-2">
        <Textarea
          rows={1}
          maxLength={2000}
          dir="auto"
          placeholder={placeholder ?? copy.composerPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
            e.preventDefault()
            if (!busy) onSend()
          }}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-sm text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
        />
        <QuotaWheel refreshKey={usageKey} />
        {busy ? (
          <IconButton onClick={onStop} aria-label={copy.stop} size="md" className="shrink-0">
            <Square className="size-4 fill-current" aria-hidden />
          </IconButton>
        ) : (
          <IconButton onClick={onSend} disabled={!value.trim()} aria-label={copy.send} size="md" className="shrink-0">
            <Send className="size-5 rtl:-scale-x-100" aria-hidden />
          </IconButton>
        )}
      </div>
    </div>
  )
}
