'use client'

import { useState } from 'react'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OptionChip } from '@/components/ui/OptionChip'
import { Textarea } from '@/components/ui/textarea'
import { apiFetchAuth } from '@/lib/apiBase'
import { CSAT_COMMENT_MAX } from '@/lib/support/conversation'
import { useSupportCopy } from '@/lib/support/supportCopy'

/** "How did we do?" under a resolved conversation: one tap, an optional line, asked once. */
export function SupportCsat({ number, onDone }: { number: number; onDone: () => void }) {
  const copy = useSupportCopy()
  const [rating, setRating] = useState<1 | -1 | null>(null)
  const [comment, setComment] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')

  const submit = async () => {
    if (!rating) return
    setState('sending')
    try {
      const res = await apiFetchAuth(`/api/support/tickets/${number}/csat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating, comment: comment.trim() || undefined }) })
      // 409 means it was already rated (another device): the question is answered either way.
      if (res.ok || res.status === 409) {
        setState('done')
        onDone()
        return
      }
    } catch {
      /* falls through to idle */
    }
    setState('idle')
  }

  if (state === 'done') return <p role="status" className="py-2 text-center text-sm text-[var(--color-brand-text-secondary)]">{copy.csatThanks}</p>

  return (
    <section aria-label={copy.csatAsk} className="mx-auto w-full max-w-sm space-y-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4 text-center">
      <p className="text-sm font-semibold text-[var(--color-brand-text-primary)]">{copy.csatAsk}</p>
      <div className="flex justify-center gap-2">
        <OptionChip selected={rating === 1} onClick={() => setRating(1)}><ThumbsUp aria-hidden />{copy.csatUp}</OptionChip>
        <OptionChip selected={rating === -1} onClick={() => setRating(-1)}><ThumbsDown aria-hidden />{copy.csatDown}</OptionChip>
      </div>
      {rating ? (
        <>
          <Textarea rows={2} dir="auto" maxLength={CSAT_COMMENT_MAX} value={comment} onChange={(e) => setComment(e.target.value)} aria-label={copy.csatComment} placeholder={copy.csatComment} className="resize-none rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] text-sm" />
          <Button size="touch" className="w-full" loading={state === 'sending'} onClick={() => void submit()}>{copy.csatSend}</Button>
        </>
      ) : null}
    </section>
  )
}
