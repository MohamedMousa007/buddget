'use client'

import { useState } from 'react'
import { ArrowLeft, Lock, Plus, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SelectField } from '@/components/ui/SelectField'
import { adminNavigate, useAdminRoute } from '../adminRouter'
import { useAdminQuery } from '../adminClient'
import { ago, dateTime } from '../format'
import { useAdminAction } from '../useAdminAction'
import { AdminSheet } from '../ui/AdminSheet'
import { DataTable, type Column } from '../ui/DataTable'
import { Field, Toolbar } from '../ui/Field'
import { KpiGrid, StatTile } from '../ui/Kpi'
import { KeyValue, Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import { Pill, StatusPill } from '../ui/Pill'
import type { AdminStatus } from '../types'

interface Ticket {
  id: string; number: number; user_id: string | null; requester_email: string | null; subject: string; category: string
  priority: string; status: string; assignee_id: string | null; source: string; tags: string[]
  created_at: string; updated_at: string; first_response_at: string | null; resolved_at: string | null
}
interface ListData { tickets: Ticket[]; staff: Array<{ id: string; name: string }>; counts: Record<string, number>; me: string }
interface Message { id: string; author_type: string; author_label: string | null; body: string; internal: boolean; created_at: string }

const VIEWS = [
  { value: 'active', label: 'Active' }, { value: 'mine', label: 'Mine' }, { value: 'unassigned', label: 'Unassigned' },
  { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' },
] as const
const PRIORITIES = ['low', 'normal', 'high', 'urgent'].map((v) => ({ value: v, label: v }))
const STATUSES = ['open', 'pending', 'resolved', 'closed'].map((v) => ({ value: v, label: v }))
const CATEGORIES = ['general', 'bug', 'sms', 'sync', 'billing', 'account', 'feature', 'other'].map((v) => ({ value: v, label: v }))

export default function SupportView({ status }: { status: AdminStatus }) {
  const route = useAdminRoute()
  if (route.params.ticket) return <TicketDetail id={route.params.ticket} status={status} />
  return <TicketList status={status} />
}

function TicketList({ status }: { status: AdminStatus }) {
  const [view, setView] = useState<(typeof VIEWS)[number]['value']>('active')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const { data, error, loading, refresh } = useAdminQuery<ListData>(`/api/admin/support/tickets?view=${view}${q ? `&q=${encodeURIComponent(q)}` : ''}`)
  const canReply = (status.permissions ?? []).some((p) => p === '*' || p === 'support.reply')
  const names = new Map(data?.staff.map((s) => [s.id, s.name]))

  const columns: Column<Ticket>[] = [
    { key: 'subject', header: 'Ticket', cell: (t) => <div className="min-w-0"><p className="truncate font-medium text-[var(--color-brand-text-primary)]"><span className="font-mono-numbers text-[var(--color-brand-text-muted)]">#{t.number}</span> {t.subject}</p><p className="truncate text-xs text-[var(--color-brand-text-muted)]">{t.requester_email ?? 'No email'} · {t.category}</p></div> },
    { key: 'status', header: 'Status', cell: (t) => <StatusPill status={t.status} /> },
    { key: 'priority', header: 'Priority', cell: (t) => <StatusPill status={t.priority} /> },
    { key: 'assignee', header: 'Owner', cell: (t) => <span className="text-[var(--color-brand-text-secondary)]">{t.assignee_id ? (names.get(t.assignee_id) ?? 'Teammate') : <span className="text-[var(--color-brand-amber)]">Unassigned</span>}</span> },
    { key: 'source', header: 'Source', wide: true, cell: (t) => <Pill>{t.source.replace('_', ' ')}</Pill> },
    { key: 'age', header: 'Opened', cell: (t) => <span className="text-[var(--color-brand-text-secondary)]">{ago(t.created_at)}</span> },
  ]

  return (
    <>
      <PageHeader title="Support desk" description="Every request from users, whether it came from the app, email or the SMS error queue." actions={canReply ? <Button size="touch" onClick={() => setCreating(true)}><Plus />New ticket</Button> : undefined} />
      <div className="space-y-6">
        {data ? (
          <KpiGrid>
            <StatTile compact label="Active" value={data.counts.active ?? 0} />
            <StatTile compact label="Mine" value={data.counts.mine ?? 0} />
            <StatTile compact label="Unassigned" value={data.counts.unassigned ?? 0} tone={data.counts.unassigned ? 'negative' : 'default'} />
            <StatTile compact label="Urgent" value={data.counts.urgent ?? 0} tone={data.counts.urgent ? 'negative' : 'default'} />
          </KpiGrid>
        ) : null}
        <Panel flush>
          <Toolbar>
            <div className="overflow-x-auto"><SegmentedControl ariaLabel="Ticket view" options={VIEWS} value={view} onChange={setView} fill={false} /></div>
            <Input aria-label="Search tickets" placeholder="Search subject or email" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 min-w-[200px] flex-1" />
          </Toolbar>
          {error ? <div className="p-5"><Notice tone="negative">{error}</Notice></div> : null}
          <DataTable
            rows={data?.tickets ?? []} columns={columns} rowKey={(t) => t.id} loading={loading}
            onRowClick={(t) => adminNavigate('support', { ticket: t.id })}
            empty={<div className="px-5 py-12 text-center text-sm text-[var(--color-brand-text-muted)]">Inbox zero. Nothing in this view.</div>}
          />
        </Panel>
      </div>
      <NewTicket open={creating} onClose={() => setCreating(false)} onDone={refresh} />
    </>
  )
}

function NewTicket({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [category, setCategory] = useState('general')
  const [priority, setPriority] = useState('normal')
  const { run, busy } = useAdminAction('/api/admin/support/tickets', onDone)
  return (
    <AdminSheet open={open} title="New ticket" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Subject"><Input size="brand" value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
        <Field label="What happened?"><Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="User id (optional)" hint="Paste from a profile to link the ticket."><Input size="brand" value={userId} onChange={(e) => setUserId(e.target.value)} className="font-mono-numbers text-sm" /></Field>
          <Field label="Contact email (optional)"><Input size="brand" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Category"><SelectField aria-label="Category" value={category} onChange={setCategory} items={CATEGORIES} className="h-12 w-full" /></Field>
          <Field label="Priority"><SelectField aria-label="Priority" value={priority} onChange={setPriority} items={PRIORITIES} className="h-12 w-full" /></Field>
        </div>
        <Button size="cta-block" loading={busy === 'new'} disabled={subject.trim().length < 3 || !message.trim()} onClick={async () => {
          const ok = await run('new', { subject, message, email: email || undefined, userId: userId || undefined, category, priority }, { success: 'Ticket created' })
          if (ok) { setSubject(''); setMessage(''); setEmail(''); setUserId(''); onClose() }
        }}>Create ticket</Button>
      </div>
    </AdminSheet>
  )
}

function TicketDetail({ id, status }: { id: string; status: AdminStatus }) {
  const detail = useAdminQuery<{ ticket: Ticket; messages: Message[] }>(`/api/admin/support/tickets/${id}`)
  const list = useAdminQuery<ListData>('/api/admin/support/tickets?view=active')
  const [text, setText] = useState('')
  const [internal, setInternal] = useState(false)
  const reload = async () => { await detail.refresh() }
  const { run, busy } = useAdminAction(`/api/admin/support/tickets/${id}`, reload)
  const perms = new Set(status.permissions ?? [])
  const can = (p: string) => perms.has('*') || perms.has(p)

  if (detail.error && !detail.data) return <><BackLink /><Notice tone="negative">{detail.error}</Notice></>
  if (!detail.data) return <><BackLink /><Loading rows={6} /></>
  const { ticket, messages } = detail.data
  const staff = list.data?.staff ?? []
  const canReply = can('support.reply')

  return (
    <>
      <BackLink />
      <PageHeader title={`#${ticket.number} · ${ticket.subject}`} description={`Opened ${dateTime(ticket.created_at)}`} actions={<div className="flex gap-2"><StatusPill status={ticket.status} /><StatusPill status={ticket.priority} /></div>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Panel title="Conversation" flush>
          <ol className="divide-y divide-[var(--color-brand-border)]">
            {messages.map((m) => (
              <li key={m.id} className={m.internal ? 'bg-[var(--color-brand-amber-soft)]/50 px-5 py-4' : 'px-5 py-4'}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--color-brand-text-muted)]">
                  <span className="font-semibold text-[var(--color-brand-text-primary)]">{m.author_label ?? m.author_type}</span>
                  {m.internal ? <Pill tone="warn"><Lock className="size-3" aria-hidden />Internal</Pill> : null}
                  <time title={dateTime(m.created_at)}>{ago(m.created_at)}</time>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-[var(--color-brand-text-primary)]">{m.body}</p>
              </li>
            ))}
          </ol>
          {canReply ? (
            <div className="space-y-3 border-t border-[var(--color-brand-border)] p-5">
              <Textarea aria-label="Reply" rows={4} placeholder={internal ? 'Write an internal note — the user will not see this' : 'Reply to the user — they get an in-app notification'} value={text} onChange={(e) => setText(e.target.value)} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SegmentedControl ariaLabel="Reply type" fill={false} value={internal ? 'note' : 'reply'} onChange={(v) => setInternal(v === 'note')} options={[{ value: 'reply', label: 'Reply to user' }, { value: 'note', label: 'Internal note' }]} />
                <Button size="touch" loading={busy === 'reply'} disabled={!text.trim() || (!internal && !ticket.user_id)} onClick={async () => { if (await run('reply', { op: 'reply', message: text, internal }, { success: internal ? 'Note added' : 'Reply sent' })) setText('') }}>
                  <Send />{internal ? 'Add note' : 'Send reply'}
                </Button>
              </div>
              {!internal && !ticket.user_id ? <p className="text-xs text-[var(--color-brand-text-muted)]">This ticket isn’t linked to an app user, so it can only take internal notes.</p> : null}
            </div>
          ) : null}
        </Panel>

        <div className="space-y-6">
          <Panel title="Details">
            <div className="space-y-3">
              <Field label="Status"><SelectField aria-label="Status" value={ticket.status} items={STATUSES} className="h-12 w-full" disabled={!canReply} onChange={(v) => void run('status', { op: 'update', status: v }, { success: 'Status updated' })} /></Field>
              <Field label="Priority"><SelectField aria-label="Priority" value={ticket.priority} items={PRIORITIES} className="h-12 w-full" disabled={!canReply} onChange={(v) => void run('priority', { op: 'update', priority: v }, { success: 'Priority updated' })} /></Field>
              <Field label="Category"><SelectField aria-label="Category" value={ticket.category} items={CATEGORIES} className="h-12 w-full" disabled={!canReply} onChange={(v) => void run('category', { op: 'update', category: v }, { success: 'Category updated' })} /></Field>
              <Field label="Owner">
                <SelectField aria-label="Owner" value={ticket.assignee_id ?? ''} className="h-12 w-full" disabled={!canReply}
                  items={[{ value: '', label: 'Unassigned' }, ...(can('support.manage') ? staff : staff.filter((s) => s.id === list.data?.me)).map((s) => ({ value: s.id, label: s.name }))]}
                  onChange={(v) => void run('assignee', { op: 'update', assigneeId: v || null }, { success: 'Owner updated' })} />
              </Field>
            </div>
          </Panel>
          <Panel title="Requester">
            <dl className="divide-y divide-[var(--color-brand-border)]">
              <KeyValue label="Email">{ticket.requester_email ?? '—'}</KeyValue>
              <KeyValue label="Source">{ticket.source.replace('_', ' ')}</KeyValue>
              <KeyValue label="First reply">{ticket.first_response_at ? ago(ticket.first_response_at) : 'Not yet'}</KeyValue>
            </dl>
            {ticket.user_id && can('users.view') ? <Button variant="outline" size="touch" className="mt-3 w-full" onClick={() => adminNavigate('users', { id: ticket.user_id! })}>Open user profile</Button> : null}
          </Panel>
          {can('support.manage') ? (
            <Button variant="destructive" size="touch" className="w-full" onClick={async () => { if (await run('delete', { op: 'delete' }, { success: 'Ticket deleted', confirm: { title: 'Delete this ticket?', body: 'The whole conversation is erased.', destructive: true } })) adminNavigate('support') }}>Delete ticket</Button>
          ) : null}
        </div>
      </div>
    </>
  )
}

function BackLink() {
  return <Button variant="ghost" size="touch" className="-ms-3 mb-2" onClick={() => adminNavigate('support')}><ArrowLeft />All tickets</Button>
}
