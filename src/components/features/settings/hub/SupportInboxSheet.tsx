'use client'

import { V3SheetHeader } from '@/components/features/savings-v3/V3SheetHeader'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Inbox, Send } from 'lucide-react'
import { ModalShell } from '@/components/modals/ModalShell'
import { SettingsRow } from '@/components/features/settings/SettingsRow'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { apiFetchAuth } from '@/lib/apiBase'
import { Textarea } from '@/components/ui/textarea'
import { useSettingsHubCopy } from '@/lib/i18n/settingsHubCopy'

type Row = { number: number; subject: string; status: string; updated_at: string }
type Message = { id: string; author_type: string; author_label: string; body: string }

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await apiFetchAuth(url, { cache: 'no-store' })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

/** The user's own requests and the conversation on each, with a reply box. */
export function SupportInboxSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const h = useSettingsHubCopy().help
  const close = useSettingsHubCopy().close
  const [rows, setRows] = useState<Row[] | null>(null)
  const [current, setCurrent] = useState<Row | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const loadThread = useCallback(async (number: number) => {
    const data = await getJson<{ messages: Message[] }>(`/api/support/tickets/${number}`)
    setMessages(data?.messages ?? [])
  }, [])

  useEffect(() => {
    if (!open) return
    setCurrent(null)
    void getJson<{ tickets: Row[] }>('/api/support/tickets').then((d) => setRows(d?.tickets ?? []))
  }, [open])

  const openRow = (r: Row) => {
    setCurrent(r)
    setMessages([])
    void loadThread(r.number)
  }

  const send = async () => {
    if (!current || !draft.trim()) return
    setSending(true)
    try {
      const res = await apiFetchAuth(`/api/support/tickets/${current.number}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: draft }) })
      if (res.ok) {
        setDraft('')
        await loadThread(current.number)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <ModalShell open={open} onBackdropClick={onClose} zIndexClassName="z-[110]" panelClassName="md:w-[460px]" padContent>
      <div className="flex flex-col gap-4">
        <V3SheetHeader title={current ? `#${current.number} ${current.subject}` : h.inbox} onClose={onClose} leading={current ? <IconButton onClick={() => setCurrent(null)} aria-label={close} variant="tinted" size="sm" shape="round"><ArrowLeft className="h-full w-full" /></IconButton> : null} />
        {current ? (
          <>
            <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.author_type === 'staff' ? 'self-start bg-[var(--color-brand-elevated)] text-[var(--color-brand-text-primary)]' : 'self-end bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-text-primary)]'}`}
                >
                  <p className="mb-0.5 text-xs text-[var(--color-brand-text-muted)]">{m.author_type === 'staff' ? m.author_label : h.youLabel}</p>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={h.replyHint} aria-label={h.replyHint} rows={3} maxLength={4000} className="resize-none rounded-xl border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-4 py-3" />
            <Button size="cta-block" onClick={() => { void send() }} disabled={sending || !draft.trim()}><Send className="size-4" />{h.reply}</Button>
          </>
        ) : rows && rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-brand-text-muted)]">{h.inboxEmpty}</p>
        ) : (
          <ul className="divide-y divide-[var(--color-brand-border)] overflow-hidden rounded-2xl border border-[var(--color-brand-border)]">
            {(rows ?? []).map((r) => (
              <li key={r.number}><SettingsRow icon={Inbox} title={`#${r.number} ${r.subject}`} subtitle={h.status[r.status] ?? r.status} onClick={() => openRow(r)} /></li>
            ))}
          </ul>
        )}
      </div>
    </ModalShell>
  )
}
