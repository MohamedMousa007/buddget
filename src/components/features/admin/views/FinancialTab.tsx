'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/switch'
import { adminPost, errorMessage, useAdminQuery } from '../adminClient'
import { dateTime } from '../format'
import { Field } from '../ui/Field'
import { Notice, Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'

type Mode = 'one_time' | 'permanent'

interface Access {
  isOwner: boolean
  excluded: boolean
  canRequest: boolean
  minutes: number
  mine: { id: string; state: 'pending' | 'active'; mode: Mode; expiresAt: string | null; reason: string; ticket: number | null } | null
  pending: Array<{ id: string; by: string; mode: Mode; reason: string; ticket: number | null; requestedAt: string }>
}

const MODES = [{ value: 'one_time', label: 'One time' }, { value: 'permanent', label: 'Permanent' }] as const

interface Snapshot {
  accounts: Array<{ name: string; type: string; currency: string; opening_balance: number | null; closed: boolean }>
  expenses: Array<{ date: string; description: string | null; category: string; amount: number; currency: string }>
  income: Array<{ date: string; name: string; amount: number; currency: string; status: string }>
  debts: Array<{ name: string; type: string | null; direction: string | null; starting_balance: number | null; currency: string; status: string | null }>
  goals: Array<{ name: string; target_amount: number | null; currency: string; target_date: string | null; status: string | null }>
  plan: { name: string; status: string | null } | null
}

const money = (n: number | null, c: string) => (n == null ? '-' : `${c} ${n.toLocaleString('en-US')}`)

/**
 * Financial content behind an owner-approved grant. Staff ask with a reason, one time or permanent; only the owner
 * decides and can close a user to all staff. Built from Panel, Field, SegmentedControl, Switch and Pill.
 */
export default function FinancialTab({ id }: { id: string }) {
  const { data, error, refresh } = useAdminQuery<Access>(`/api/admin/users/${id}/financial`)
  const [reason, setReason] = useState('')
  const [ticket, setTicket] = useState('')
  const [mode, setMode] = useState<Mode>('one_time')
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const act = useCallback(async (key: string, json: Record<string, unknown>) => {
    setBusy(key)
    setProblem(null)
    try {
      const res = await adminPost<{ snapshot?: Snapshot }>(`/api/admin/users/${id}/financial`, json)
      if (res.snapshot) setSnapshot(res.snapshot)
      return true
    } catch (e) {
      setProblem(errorMessage(e))
      return false
    } finally {
      setBusy(null)
    }
  }, [id])

  const readable = Boolean(data && !data.excluded && (data.isOwner || data.mine?.state === 'active'))
  useEffect(() => {
    if (!readable) {
      setSnapshot(null)
      return
    }
    void act('read', { op: 'read' })
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [readable, act])

  if (error && !data) return <Notice tone="negative">{error}</Notice>
  if (!data) return null
  const after = async (key: string, json: Record<string, unknown>) => {
    if (await act(key, json)) await refresh()
  }
  const minutesLeft = data.mine?.expiresAt ? Math.max(0, Math.round((Date.parse(data.mine.expiresAt) - now) / 60_000)) : 0

  return (
    <div className="space-y-6">
      {problem ? <Notice tone="negative">{problem}</Notice> : null}

      {data.isOwner ? (
        <Panel title="Staff access" description="Only you decide who sees this person’s financial details.">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">Close to all staff</p>
              <p className="text-xs text-[var(--color-brand-text-muted)]">No one can ask for access, and open access ends now. You can still read.</p>
            </div>
            <Switch size="touch" checked={data.excluded} disabled={busy === 'exclude'} aria-label="Close this account to all staff" onCheckedChange={(v) => void after('exclude', { op: v ? 'exclude' : 'include' })} />
          </div>
          {data.pending.length > 0 ? (
            <ul className="mt-4 divide-y divide-[var(--color-brand-border)] border-t border-[var(--color-brand-border)]">
              {data.pending.map((p) => (
                <li key={p.id} className="space-y-2 py-3">
                  <div className="min-w-0 text-sm">
                    <p className="text-[var(--color-brand-text-primary)]">{p.by} asks for {p.mode === 'permanent' ? 'permanent' : 'one-time'} access</p>
                    <p className="text-[var(--color-brand-text-secondary)]">{p.reason}</p>
                    <p className="text-xs text-[var(--color-brand-text-muted)]">{dateTime(p.requestedAt)}{p.ticket ? ` · ticket #${p.ticket}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="touch" loading={busy === `${p.id}:one_time`} disabled={data.excluded} onClick={() => void after(`${p.id}:one_time`, { op: 'approve', grantId: p.id, mode: 'one_time' })}>Approve for {data.minutes} min</Button>
                    <Button variant="outline" size="touch" loading={busy === `${p.id}:permanent`} disabled={data.excluded} onClick={() => void after(`${p.id}:permanent`, { op: 'approve', grantId: p.id, mode: 'permanent' })}>Approve permanently</Button>
                    <Button variant="outline" size="touch" loading={busy === `${p.id}:deny`} onClick={() => void after(`${p.id}:deny`, { op: 'deny', grantId: p.id })}>Deny</Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ) : null}

      {data.excluded && !data.isOwner ? (
        <Notice>The owner has closed staff access to this account.</Notice>
      ) : data.isOwner ? null : !data.mine ? (
        data.canRequest ? (
          <Panel title="Financial details are protected" description="Transactions, balances, debts and goals open only with the owner’s approval. Every read is logged, and the user is told.">
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void after('request', { op: 'request', mode, reason, ticket: ticket ? Number(ticket) : undefined }) }}>
              <Field label="Access"><SegmentedControl ariaLabel="Access length" options={MODES} value={mode} onChange={setMode} /></Field>
              <Field label="Reason"><Input size="brand" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="What are you helping with?" /></Field>
              <Field label="Ticket number (optional)"><Input size="brand" inputMode="numeric" value={ticket} onChange={(e) => setTicket(e.target.value.replace(/\D/g, ''))} /></Field>
              <Button type="submit" size="touch" loading={busy === 'request'} disabled={reason.trim().length < 8}>Ask the owner</Button>
            </form>
          </Panel>
        ) : (
          <Notice>Your role cannot request access to financial details.</Notice>
        )
      ) : data.mine.state === 'pending' ? (
        <Notice>Your request is waiting for the owner. Refresh this page to see the answer.</Notice>
      ) : (
        <Panel
          title="Access open"
          description={`${data.mine.mode === 'permanent' ? 'Permanent access' : `${minutesLeft} minute${minutesLeft === 1 ? '' : 's'} left`} · ${data.mine.reason}`}
          actions={<Button variant="outline" size="touch" loading={busy === 'revoke'} onClick={() => void after('revoke', { op: 'revoke', grantId: data.mine!.id })}>Close access</Button>}
        >
          {snapshot ? <SnapshotView snapshot={snapshot} /> : <p className="text-sm text-[var(--color-brand-text-muted)]">Loading…</p>}
        </Panel>
      )}

      {data.isOwner && !data.excluded ? (
        <Panel title="Financial details" actions={<Pill tone="brand">Owner</Pill>}>
          {snapshot ? <SnapshotView snapshot={snapshot} /> : <p className="text-sm text-[var(--color-brand-text-muted)]">Loading…</p>}
        </Panel>
      ) : null}
    </div>
  )
}

function Rows({ title, empty, rows }: { title: string; empty: string; rows: string[][] }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-brand-text-muted)]">{empty}</p>
      ) : (
        <ul className="divide-y divide-[var(--color-brand-border)] rounded-lg border border-[var(--color-brand-border)]">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-[var(--color-brand-text-primary)]">{r[0]}</span>
              <span className="text-xs text-[var(--color-brand-text-muted)]">{r[1]}</span>
              <span className="font-mono-numbers text-[var(--color-brand-text-primary)]">{r[2]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SnapshotView({ snapshot: s }: { snapshot: Snapshot }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Rows title="Accounts" empty="None" rows={s.accounts.map((a) => [a.name, `${a.type}${a.closed ? ' · closed' : ''}`, money(a.opening_balance, a.currency)])} />
      <Rows title="Recent spending" empty="None" rows={s.expenses.map((e) => [e.description || e.category, e.date, money(e.amount, e.currency)])} />
      <Rows title="Recent income" empty="None" rows={s.income.map((i) => [i.name, i.date, money(i.amount, i.currency)])} />
      <Rows title="Debts" empty="None" rows={s.debts.map((d) => [d.name, `${d.type ?? ''} ${d.direction ?? ''}`.trim(), money(d.starting_balance, d.currency)])} />
      <Rows title="Goals" empty="None" rows={s.goals.map((g) => [g.name, g.target_date ?? '', money(g.target_amount, g.currency)])} />
      <Rows title="Budget" empty="No plan" rows={s.plan ? [[s.plan.name, s.plan.status ?? '', '']] : []} />
    </div>
  )
}
