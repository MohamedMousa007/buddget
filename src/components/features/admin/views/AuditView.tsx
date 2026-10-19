'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminFetch, errorMessage } from '../adminClient'
import { dateTime } from '../format'
import { DataTable, type Column } from '../ui/DataTable'
import { Toolbar } from '../ui/Field'
import { Notice, PageHeader, Panel } from '../ui/Panel'
import { Pill, type Tone } from '../ui/Pill'

interface AuditRow { id: number; actor_email: string | null; action: string; target_type: string | null; target_id: string | null; summary: string | null; metadata: Record<string, unknown>; ip: string | null; created_at: string }

const toneOf = (action: string): Tone => (/delete|remove|suspend|reset|failed|revoked/.test(action) ? 'bad' : /login|setup|enroll/.test(action) ? 'brand' : /create|invite|upsert|promote|restore/.test(action) ? 'good' : 'neutral')

export default function AuditView() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [cursor, setCursor] = useState<number | null>(null)
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [applied, setApplied] = useState({ action: '', actor: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  const load = useCallback(async (append: boolean, from: number | null) => {
    setLoading(true)
    try {
      const p = new URLSearchParams({ limit: '50' })
      if (applied.action) p.set('action', applied.action)
      if (applied.actor) p.set('actor', applied.actor)
      if (append && from) p.set('cursor', String(from))
      const res = await adminFetch<{ rows: AuditRow[]; nextCursor: number | null }>(`/api/admin/audit?${p}`)
      setRows((prev) => (append ? [...prev, ...res.rows] : res.rows))
      setCursor(res.nextCursor)
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [applied])

  useEffect(() => {
    void load(false, null)
  }, [load])

  const columns: Column<AuditRow>[] = [
    { key: 'when', header: 'When', cell: (r) => <span className="whitespace-nowrap text-[var(--color-brand-text-secondary)]">{dateTime(r.created_at)}</span> },
    { key: 'who', header: 'Who', cell: (r) => <span className="text-[var(--color-brand-text-primary)]">{r.actor_email ?? 'system'}</span> },
    { key: 'action', header: 'Action', cell: (r) => <Pill tone={toneOf(r.action)}>{r.action}</Pill> },
    { key: 'what', header: 'Detail', cell: (r) => (
      <div className="min-w-0">
        <p className="truncate text-[var(--color-brand-text-primary)]">{r.summary ?? `${r.target_type ?? ''} ${r.target_id ?? ''}`}</p>
        {open === r.id ? <pre className="mt-2 max-w-xl select-text whitespace-pre-wrap break-all rounded-lg bg-[var(--color-brand-elevated)] p-2 font-mono text-[11px] text-[var(--color-brand-text-secondary)]">{JSON.stringify({ target: `${r.target_type}:${r.target_id}`, ip: r.ip, ...r.metadata }, null, 2)}</pre> : null}
      </div>
    ) },
  ]

  return (
    <>
      <PageHeader title="Audit log" description="Every privileged action, who did it and when. Append-only: entries can’t be edited or deleted." />
      <Panel flush>
        <Toolbar>
          <form className="flex flex-1 flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setApplied({ action: action.trim(), actor: actor.trim() }) }}>
            <Input aria-label="Action prefix" placeholder="Action, e.g. user. or auth.login" value={action} onChange={(e) => setAction(e.target.value)} className="h-10 min-w-[200px] flex-1" />
            <Input aria-label="Actor" placeholder="Actor email" value={actor} onChange={(e) => setActor(e.target.value)} className="h-10 min-w-[200px] flex-1" />
            <Button type="submit" variant="outline" size="touch">Filter</Button>
          </form>
        </Toolbar>
        {error ? <div className="p-5"><Notice tone="negative">{error}</Notice></div> : null}
        <DataTable rows={rows} columns={columns} rowKey={(r) => String(r.id)} loading={loading} onRowClick={(r) => setOpen(open === r.id ? null : r.id)} />
        {cursor ? <div className="border-t border-[var(--color-brand-border)] p-4"><Button variant="outline" size="touch" className="w-full" loading={loading} onClick={() => void load(true, cursor)}>Load older</Button></div> : null}
      </Panel>
    </>
  )
}
