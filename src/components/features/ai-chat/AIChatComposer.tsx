'use client'

import { Mic, Send, Square } from 'lucide-react'
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
  /** The voice message control. Absent where voice is not offered. */
  mic?: { state: 'idle' | 'recording' | 'transcribing'; error: string | null; onStart: () => void; onStop: () => void }
}

/** Message box: Enter sends, Shift+Enter breaks the line, and it never fires mid-IME-composition. */
export function AIChatComposer({ value, onChange, onSend, onStop, busy, placeholder, usageKey, mic }: AIChatComposerProps) {
  const copy = useBuddgyChatCopy()
  return (
    <div className="border-t border-[var(--color-brand-border)] p-3">
      {mic?.state === 'transcribing' ? <p role="status" dir="auto" className="pb-2 text-xs text-[var(--color-brand-text-muted)]">{copy.micSending}</p> : null}
      {mic?.error ? <p role="alert" dir="auto" className="pb-2 text-xs text-[var(--color-brand-red)]">{mic.error}</p> : null}
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
        {mic ? (
          <IconButton
            onClick={mic.state === 'recording' ? mic.onStop : mic.onStart}
            disabled={busy || mic.state === 'transcribing'}
            aria-label={mic.state === 'recording' ? copy.micStop : copy.mic}
            aria-pressed={mic.state === 'recording'}
            size="md"
            className={mic.state === 'recording' ? 'shrink-0 bg-[var(--color-brand-red-soft)] text-[var(--color-brand-red)]' : 'shrink-0'}
          >
            {mic.state === 'recording' ? <Square className="size-4 fill-current" aria-hidden /> : <Mic className="size-5" aria-hidden />}
          </IconButton>
        ) : null}
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
