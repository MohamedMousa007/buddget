'use client'

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useForegroundPoll } from '@/hooks/useForegroundPoll'
import { useLocalizedFormatters } from '@/hooks/useLocalizedFormatters'
import { apiFetchAuth } from '@/lib/apiBase'
import type { Attachment } from '@/lib/support/attachments'
import { refreshSupportUnread } from '@/lib/support/openThread'
import { useSupportCopy } from '@/lib/support/supportCopy'
import { cn } from '@/lib/utils'
import { SupportComposer } from './SupportComposer'
import { SupportCsat } from './SupportCsat'
import { SignedImage } from './SignedImage'
import { PHOTO_ONLY_BODY, type CarriedDraft, type PendingMessage, type ThreadMessage, type ThreadTicket } from './types'

const POLL_MS = 15_000

interface Bubble {
  key: string
  mine: boolean
  name: string | null
  body: string
  at: string
  images: string[]
  pending?: PendingMessage
}

const dayKey = (iso: string) => new Date(iso).toDateString()

/** One conversation as a chat: day separators, grouped bubbles, sending and failed states, the reply bar pinned below. */
export function SupportThread({ number, onTicket, onStartNew }: { number: number; onTicket: (t: ThreadTicket) => void; onStartNew: (draft?: CarriedDraft) => void }) {
  const copy = useSupportCopy()
  const fmt = useLocalizedFormatters()
  const [ticket, setTicket] = useState<ThreadTicket | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState<PendingMessage[]>([])
  /** Rated in this view: the CSAT card stays to say thanks even after the next poll reports it answered. */
  const [rated, setRated] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const seen = useRef(0)

  const load = useCallback(async () => {
    try {
      const res = await apiFetchAuth(`/api/support/tickets/${number}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { ticket: ThreadTicket; messages: ThreadMessage[] }
      setTicket(data.ticket)
      setMessages((prev) => {
        // Opening the thread (or a new reply arriving while it is open) moved the read mark on the server: the badge follows.
        if (!prev || data.messages.length !== prev.length) void refreshSupportUnread()
        return data.messages
      })
      setFailed(false)
      onTicket(data.ticket)
    } catch {
      setFailed(true)
    }
  }, [number, onTicket])

  useEffect(() => {
    void load()
  }, [load])
  useForegroundPoll(() => void load(), POLL_MS, true)

  const bubbles: Bubble[] = [
    ...(messages ?? []).map((m) => ({
      key: m.id,
      mine: m.author_type === 'user',
      name: m.author_type === 'staff' ? m.author_name : null,
      body: m.attachments.length && m.body === PHOTO_ONLY_BODY ? '' : m.body,
      at: m.created_at,
      images: m.attachments.map((a) => a.url),
    })),
    ...pending.map((p) => ({ key: p.localId, mine: true, name: null, body: p.body, at: p.created_at, images: p.previews, pending: p })),
  ]

  // Follow the conversation to its newest message whenever one arrives.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || bubbles.length === seen.current) return
    seen.current = bubbles.length
    el.scrollTop = el.scrollHeight
  })

  const post = useCallback(
    async (p: PendingMessage) => {
      setPending((list) => list.map((x) => (x.localId === p.localId ? { ...x, state: 'sending' } : x)))
      try {
        const res = await apiFetchAuth(`/api/support/tickets/${number}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: p.body, attachments: p.attachments }),
        })
        if (res.status === 409) {
          // Closed meanwhile: the message stays on screen, marked, and can move to a new conversation with its photos.
          setPending((list) => list.map((x) => (x.localId === p.localId ? { ...x, state: 'closed' } : x)))
          await load()
          return
        }
        if (!res.ok) throw new Error(String(res.status))
        await load()
        // React batches this with the reload's state, so the sent message never shows twice.
        setPending((list) => list.filter((x) => x.localId !== p.localId))
      } catch {
        setPending((list) => list.map((x) => (x.localId === p.localId ? { ...x, state: 'failed' } : x)))
      }
    },
    [number, load],
  )

  const send = (body: string, attachments: Attachment[], previews: string[]) => {
    const p: PendingMessage = { localId: crypto.randomUUID(), body, attachments, previews, state: 'sending', created_at: new Date().toISOString() }
    setPending((list) => [...list, p])
    void post(p)
  }

  if (!messages) {
    return (
      <div className="grid flex-1 place-items-center p-8 text-sm text-[var(--color-brand-text-muted)]">
        {failed ? (
          <div className="space-y-3 text-center">
            <p>{copy.loadFailed}</p>
            <Button variant="outline" size="touch" onClick={() => void load()}>{copy.retry}</Button>
          </div>
        ) : (
          <Loader2 className="size-6 animate-spin" aria-label={copy.sending} />
        )}
      </div>
    )
  }

  return (
    <>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain touch-pan-y px-4 py-3" aria-live="polite" aria-relevant="additions">
        <ol className="flex flex-col">
          {bubbles.map((b, i) => {
            const prev = bubbles[i - 1]
            const newDay = !prev || dayKey(prev.at) !== dayKey(b.at)
            const runStart = newDay || !prev || prev.mine !== b.mine || prev.name !== b.name
            const next = bubbles[i + 1]
            const runEnd = !next || next.mine !== b.mine || next.name !== b.name || dayKey(next.at) !== dayKey(b.at)
            return (
              <Fragment key={b.key}>
                {newDay ? (
                  <li className="my-3 flex justify-center" aria-hidden={false}>
                    <span className="rounded-full bg-[var(--color-brand-elevated)] px-3 py-1 text-[0.6875rem] font-semibold text-[var(--color-brand-text-secondary)]">{fmt.groupByDate(b.at)}</span>
                  </li>
                ) : null}
                <li className={cn('flex max-w-[82%] flex-col', b.mine ? 'self-end items-end' : 'self-start items-start', runStart ? 'mt-3' : 'mt-0.5')}>
                  {runStart && !b.mine ? (
                    <span className="mb-1 px-1 text-xs font-semibold text-[var(--color-brand-text-secondary)]">
                      {copy.team}
                      {b.name ? <span className="font-normal text-[var(--color-brand-text-muted)]"> · {b.name}</span> : null}
                    </span>
                  ) : null}
                  {b.images.length ? (
                    <div className={cn('mb-1 grid gap-1', b.images.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                      {b.images.map((src, k) => (
                        <a key={`${b.key}-${k}`} href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl" aria-label={`${copy.photo} ${k + 1}`}>
                          <SignedImage src={src} className="max-h-48 w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {b.body ? (
                    <p
                      dir="auto"
                      className={cn(
                        'whitespace-pre-wrap break-words px-3.5 py-2 text-[0.9375rem] leading-snug [text-wrap:pretty]',
                        b.mine
                          ? 'bg-[var(--color-brand-primary)] text-[var(--color-brand-on-primary)] rounded-2xl'
                          : 'bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)] rounded-2xl',
                        b.mine && !runEnd && 'rounded-ee-md',
                        b.mine && !runStart && 'rounded-se-md',
                        !b.mine && !runEnd && 'rounded-es-md',
                        !b.mine && !runStart && 'rounded-ss-md',
                        b.pending?.state === 'sending' && 'opacity-70',
                      )}
                    >
                      {b.body}
                    </p>
                  ) : null}
                  {b.pending?.state === 'closed' ? (
                    <span className="mt-0.5 flex flex-col items-end gap-0.5 px-1">
                      <span className="inline-flex items-center gap-1 text-xs text-[var(--color-brand-red)]"><AlertCircle className="size-3.5" aria-hidden />{copy.closedNotSent}</span>
                      <Button variant="link" size="sm" className="h-auto px-0 text-xs" onClick={() => onStartNew({ body: b.pending!.body, attachments: b.pending!.attachments, previews: b.pending!.previews })}>
                        {copy.startNew}
                      </Button>
                    </span>
                  ) : b.pending?.state === 'failed' ? (
                    <Button variant="link" size="sm" className="mt-0.5 h-auto gap-1 px-1 text-xs text-[var(--color-brand-red)]" onClick={() => void post(b.pending!)}>
                      <AlertCircle className="size-3.5" aria-hidden />
                      {copy.failed} · {copy.retry}
                    </Button>
                  ) : runEnd ? (
                    <span className="mt-1 inline-flex items-center gap-1 px-1 font-mono-numbers text-[0.6875rem] text-[var(--color-brand-text-muted)]">
                      {b.pending ? copy.sending : fmt.formatTime(b.at)}
                      {b.mine && !b.pending ? <Check className="size-3" aria-hidden /> : null}
                    </span>
                  ) : null}
                </li>
              </Fragment>
            )
          })}
        </ol>
        {ticket?.display_status === 'resolved' ? <p className="mx-auto mt-5 max-w-xs text-center text-xs text-[var(--color-brand-text-muted)] [text-wrap:pretty]">{copy.resolvedNote}</p> : null}
        {ticket?.can_rate || rated ? <div className="mt-4"><SupportCsat number={number} onDone={() => setRated(true)} /></div> : null}
      </div>
      {ticket?.can_reply === false ? (
        <div className="shrink-0 space-y-2 border-t border-[var(--color-brand-border)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center">
          <p className="text-sm text-[var(--color-brand-text-secondary)]">{copy.closedNote}</p>
          <Button size="touch" className="w-full" onClick={() => onStartNew()}><Plus />{copy.startNew}</Button>
        </div>
      ) : (
        <SupportComposer onSend={send} />
      )}
    </>
  )
}
