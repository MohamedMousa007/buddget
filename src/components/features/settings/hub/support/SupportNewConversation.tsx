'use client'

import { useState } from 'react'
import { Bug, ImagePlus, Lightbulb, MessageCircleQuestion, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Textarea } from '@/components/ui/textarea'
import { apiFetchAuth } from '@/lib/apiBase'
import { useLocale } from '@/lib/i18n'
import { collectSupportContext } from '@/lib/support/clientContext'
import { useSupportCopy } from '@/lib/support/supportCopy'
import { AttachmentStrip } from './AttachmentStrip'
import { useImageAttachments } from './useImageAttachments'

type Kind = 'bug' | 'idea' | 'question'

/** Starts a conversation: what it is about, a subject, details, screenshots. Device context rides along. */
export function SupportNewConversation({ onCreated, fromRoute }: { onCreated: (number: number) => void; fromRoute?: string }) {
  const copy = useSupportCopy()
  const { locale } = useLocale()
  const [kind, setKind] = useState<Kind>('bug')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const att = useImageAttachments()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending || att.busy) return
    setSending(true)
    setError(null)
    try {
      const context = await collectSupportContext(locale, fromRoute)
      const res = await apiFetchAuth('/api/support/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chosen: kind, title, description, context, attachments: att.ready }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { number?: number }
      if (!data.number) throw new Error('no number')
      att.reset()
      onCreated(data.number)
    } catch {
      setError(copy.startFailed)
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <SegmentedControl<Kind>
        ariaLabel={copy.kindLabel}
        value={kind}
        onChange={setKind}
        options={[
          { value: 'bug', label: copy.bug, icon: <Bug /> },
          { value: 'idea', label: copy.idea, icon: <Lightbulb /> },
          { value: 'question', label: copy.question, icon: <MessageCircleQuestion /> },
        ]}
      />
      <Input size="brand" dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={copy.subjectHint} aria-label={copy.subject} required minLength={3} maxLength={200} />
      <Textarea
        dir="auto"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={copy.detailsHint}
        aria-label={copy.details}
        rows={5}
        maxLength={5000}
        className="resize-none rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 py-3"
      />
      <AttachmentStrip att={att} />
      <Button type="button" variant="outline" size="touch" onClick={att.pick} disabled={att.full}>
        <ImagePlus />{copy.attach}
      </Button>
      <p className="text-xs text-[var(--color-brand-text-muted)] [text-wrap:pretty]">{copy.contextNote}</p>
      {error ? <p role="alert" className="text-sm text-[var(--color-brand-red)]">{error}</p> : null}
      <Button type="submit" size="cta-block" loading={sending} disabled={title.trim().length < 3 || att.busy}>
        <Send className="rtl:-scale-x-100" />{copy.start}
      </Button>
    </form>
  )
}
