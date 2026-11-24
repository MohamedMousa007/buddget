'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { Badge } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/IconButton'
import { useForegroundPoll } from '@/hooks/useForegroundPoll'
import { apiFetchAuth } from '@/lib/apiBase'
import { useSupportThreadStore } from '@/lib/support/openThread'
import { useSupportCopy } from '@/lib/support/supportCopy'
import { STATUS_TONE, SupportConversationList } from './SupportConversationList'
import { SupportNewConversation } from './SupportNewConversation'
import { SupportThread } from './SupportThread'
import type { ConversationRow, ThreadTicket } from './types'

const POLL_MS = 15_000

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'thread'; number: number }

/**
 * Help and feedback as one place: the conversation list, a new message, and each thread as a chat. Opens on a thread
 * when a push or notification asked for one, or on a new message when the caller says so.
 */
export function SupportMessagesSheet({ open, onClose, startNew = false }: { open: boolean; onClose: () => void; startNew?: boolean }) {
  // Every opening starts fresh (list, new message or the requested thread); closing keeps the content for the exit animation.
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSession((n) => n + 1)
  }
  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]" scrollChild panelClassName="h-[88dvh] md:h-[min(720px,88dvh)] md:w-[480px]">
      <SheetBody key={session} open={open} onClose={onClose} startNew={startNew} />
    </ModalShell>
  )
}

function SheetBody({ open, onClose, startNew }: { open: boolean; onClose: () => void; startNew: boolean }) {
  const copy = useSupportCopy()
  const pending = useSupportThreadStore((s) => s.pending)
  const [view, setView] = useState<View>(() => (pending !== null ? { kind: 'thread', number: pending } : startNew ? { kind: 'new' } : { kind: 'list' }))
  const [rows, setRows] = useState<ConversationRow[] | null>(null)
  const [ticket, setTicket] = useState<ThreadTicket | null>(null)

  // A tapped push or notification row, even while the sheet is already open, switches to that thread.
  if (open && pending !== null && !(view.kind === 'thread' && view.number === pending)) {
    setView({ kind: 'thread', number: pending })
    setTicket(null)
  }
  useEffect(() => {
    if (open && pending !== null) useSupportThreadStore.setState({ pending: null })
  }, [open, pending])

  const loadList = useCallback(
    () =>
      apiFetchAuth('/api/support/tickets', { cache: 'no-store' })
        .then((res) => (res.ok ? (res.json() as Promise<{ tickets: ConversationRow[]; unread: number }>) : null))
        .then((data) => {
          if (!data) return
          setRows(data.tickets)
          useSupportThreadStore.setState({ unread: data.unread })
        })
        .catch(() => setRows((r) => r ?? [])),
    [],
  )

  useEffect(() => {
    if (!open) return
    void loadList()
  }, [open, loadList])
  useForegroundPoll(() => void loadList(), POLL_MS, open && view.kind === 'list')

  const back = () => {
    setView({ kind: 'list' })
    setTicket(null)
    void loadList()
  }

  const title = view.kind === 'thread' ? (ticket?.subject ?? `#${view.number}`) : view.kind === 'new' ? copy.newMessage : copy.conversations
  const leading = view.kind === 'list' ? null : (
    <IconButton onClick={back} aria-label={copy.back} variant="tinted" size="sm" shape="round">
      <ArrowLeft className="h-full w-full rtl:rotate-180" />
    </IconButton>
  )

  return (
    <>
      <V3SheetHeader onClose={onClose} leading={leading}>
        <V3SheetHeader.Title size="compact">{title}</V3SheetHeader.Title>
        {view.kind === 'thread' && ticket ? (
          <V3SheetHeader.Subtitle>
            <span className="inline-flex items-center gap-2">
              <span className="font-mono-numbers">#{ticket.number}</span>
              <Badge tone={STATUS_TONE[ticket.display_status]} size="xs" bordered={false}>{copy.status[ticket.display_status]}</Badge>
            </span>
          </V3SheetHeader.Subtitle>
        ) : null}
      </V3SheetHeader>
      {view.kind === 'thread' ? (
        <SupportThread key={view.number} number={view.number} onTicket={setTicket} onStartNew={() => setView({ kind: 'new' })} />
      ) : view.kind === 'new' ? (
        <SupportNewConversation onCreated={(n) => { setView({ kind: 'thread', number: n }); void loadList() }} />
      ) : (
        <SupportConversationList rows={rows} onOpen={(n) => setView({ kind: 'thread', number: n })} onNew={() => setView({ kind: 'new' })} />
      )}
    </>
  )
}
