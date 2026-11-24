'use client'

import { useState } from 'react'
import { ImagePlus, Send } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { Textarea } from '@/components/ui/textarea'
import { useSupportCopy } from '@/lib/support/supportCopy'
import type { Attachment } from '@/lib/support/attachments'
import { AttachmentStrip } from './AttachmentStrip'
import { useImageAttachments } from './useImageAttachments'

const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

/**
 * The reply bar pinned under a thread: grows with the text, Enter sends on a keyboard and breaks the line on a phone,
 * never fires mid-IME-composition. Same shape as the Buddgy chat composer.
 */
export function SupportComposer({ onSend }: { onSend: (body: string, attachments: Attachment[], previews: string[]) => void }) {
  const copy = useSupportCopy()
  const [value, setValue] = useState('')
  const att = useImageAttachments()
  const canSend = (value.trim().length > 0 || att.ready.length > 0) && !att.busy

  const send = () => {
    if (!canSend) return
    onSend(value.trim(), att.ready, att.items.filter((i) => i.uploaded).map((i) => i.preview))
    setValue('')
    att.reset()
  }

  return (
    <div className="shrink-0 space-y-2 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] [[data-keyboard-open=true]_&]:pb-3">
      <AttachmentStrip att={att} />
      <div className="flex items-end gap-2">
        <IconButton onClick={att.pick} disabled={att.full} aria-label={copy.attach} size="md" className="shrink-0">
          <ImagePlus className="size-5" aria-hidden />
        </IconButton>
        <Textarea
          rows={1}
          maxLength={4000}
          dir="auto"
          aria-label={copy.composer}
          placeholder={copy.composer}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || coarsePointer()) return
            e.preventDefault()
            send()
          }}
          className="field-sizing-content max-h-32 min-h-11 flex-1 resize-none rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-[0.9375rem] text-[var(--color-brand-text-primary)] placeholder:text-[var(--color-brand-text-muted)]"
        />
        <IconButton onClick={send} disabled={!canSend} aria-label={copy.send} variant="solid" size="md" shape="round" className="shrink-0">
          <Send className="size-5 rtl:-scale-x-100" aria-hidden />
        </IconButton>
      </div>
    </div>
  )
}
