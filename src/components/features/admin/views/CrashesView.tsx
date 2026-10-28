'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useAdminQuery } from '../adminClient'
import { ago, dateTime } from '../format'
import { useAdminAction } from '../useAdminAction'
import { AdminSheet } from '../ui/AdminSheet'
import { DataTable, type Column } from '../ui/DataTable'
import { KpiGrid, StatTile } from '../ui/Kpi'
import { Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import { Pill, StatusPill, type Tone } from '../ui/Pill'
import type { AdminStatus } from '../types'

interface Crash {
  id: string; fingerprint: string; release: string; level: string; title: string; culprit: string | null; stack: string | null
  platform: string | null; build: string | null; device_id: string | null; user_id: string | null; occurrences: number
  first_seen: string; last_seen: string; status: string; sentry_url: string | null
}
interface CrashData {
  rows: Crash[]
  stats: { newToday: number; seen7d: number; affectedUsers: number; open: number }
  releases: string[]
}

const LEVEL_TONE: Record<string, Tone> = { fatal: 'bad', error: 'warn', warning: 'neutral', info: 'neutral' }
const STATUS_FILTERS = [{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }, { value: 'all', label: 'All' }]

/** App crashes and errors by release, from Sentry. Built from Kpi, DataTable, AdminSheet and SegmentedControl. */
export default function CrashesView({ status }: { status: AdminStatus }) {
  const [filter, setFilter] = useState('open')
  const [release, setRelease] = useState('')
  const [open, setOpen] = useState<Crash | null>(null)
  const canManage = (status.permissions ?? []).some((p) => p === '*' || p === 'crashes.manage')
  const query = new URLSearchParams()
  if (filter === 'resolved') query.set('status', 'resolved')
  if (release) query.set('release', release)
  const { data, error, loading, refresh } = useAdminQuery<CrashData>(`/api/admin/crashes?${query}`)
  const { run, busy } = useAdminAction('/api/admin/crashes', refresh)

  const rows = (data?.rows ?? []).filter((r) => (filter === 'open' ? r.status !== 'resolved' : true))
  const mark = async (c: Crash, next: 'acknowledged' | 'resolved' | 'new') => {
    if (await run(`${c.id}:${next}`, { id: c.id, status: next }, { success: next === 'resolved' ? 'Marked resolved' : 'Updated' })) setOpen({ ...c, status: next })
  }

  const columns: Column<Crash>[] = [
    { key: 'title', header: 'Crash', cell: (c) => <div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--color-brand-text-primary)]">{c.title}</p>{c.culprit ? <p className="truncate font-mono text-xs text-[var(--color-brand-text-muted)]">{c.culprit}</p> : null}</div> },
    { key: 'level', header: 'Level', cell: (c) => <Pill tone={LEVEL_TONE[c.level] ?? 'neutral'}>{c.level}</Pill> },
    { key: 'release', header: 'Release', cell: (c) => <span className="font-mono-numbers text-xs">{c.release.replace('buddget@', '') || '-'}{c.build ? ` (${c.build})` : ''}</span> },
    { key: 'platform', header: 'Platform', wide: true, cell: (c) => c.platform ?? '-' },
    { key: 'count', header: 'Events', numeric: true, cell: (c) => c.occurrences },
    { key: 'status', header: 'Status', cell: (c) => <StatusPill status={c.status === 'acknowledged' ? 'pending' : c.status === 'new' ? 'open' : c.status} /> },
    { key: 'seen', header: 'Last seen', wide: true, cell: (c) => <span className="text-[var(--color-brand-text-secondary)]">{ago(c.last_seen)}</span> },
  ]

  if (error && !data) return <Notice tone="negative">{error}</Notice>

  return (
    <>
      <PageHeader title="Crashes" description="App crashes and errors by release. Native iOS and Android crashes arrive from Sentry." />
      {data ? (
        <div className="mb-5">
          <KpiGrid>
            <StatTile label="New today" value={data.stats.newToday} tone={data.stats.newToday > 0 ? 'negative' : 'default'} />
            <StatTile label="Seen this week" value={data.stats.seen7d} />
            <StatTile label="Users affected" value={data.stats.affectedUsers} sub="Last 30 days" />
            <StatTile label="Open issues" value={data.stats.open} />
          </KpiGrid>
        </div>
      ) : null}
      <Panel
        flush
        title="Issues"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl ariaLabel="Crash status" fill={false} options={STATUS_FILTERS} value={filter} onChange={setFilter} />
            {data?.releases.length ? (
              <SegmentedControl ariaLabel="Release" fill={false} options={[{ value: '', label: 'All releases' }, ...data.releases.slice(0, 4).map((r) => ({ value: r, label: r.replace('buddget@', '') }))]} value={release} onChange={setRelease} />
            ) : null}
          </div>
        }
      >
        {!data && loading ? <div className="p-5"><Loading /></div> : (
          <DataTable rows={rows} columns={columns} rowKey={(c) => c.id} onRowClick={setOpen}
            empty={<div className="px-5 py-12 text-center text-sm text-[var(--color-brand-text-muted)]">No crashes reported. Reports appear here once Sentry is connected and a build with the reporter is in use.</div>} />
        )}
      </Panel>

      {open ? (
        <AdminSheet open title={open.title.slice(0, 60)} onClose={() => setOpen(null)} wide>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Pill tone={LEVEL_TONE[open.level] ?? 'neutral'}>{open.level}</Pill>
              <Pill>{open.platform ?? 'unknown platform'}</Pill>
              <Pill tone="brand">{open.release.replace('buddget@', '') || 'no release'}{open.build ? ` (${open.build})` : ''}</Pill>
              <Pill>{open.occurrences} event{open.occurrences === 1 ? '' : 's'}</Pill>
            </div>
            <p className="text-xs text-[var(--color-brand-text-muted)]">First seen {dateTime(open.first_seen)} · last seen {dateTime(open.last_seen)}{open.device_id ? ` · device ${open.device_id.slice(0, 8)}` : ''}</p>
            <pre className="max-h-72 overflow-auto rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3 font-mono text-xs leading-relaxed text-[var(--color-brand-text-secondary)]">{open.stack ?? 'No stack trace was captured.'}</pre>
            <div className="flex flex-wrap gap-2">
              {open.sentry_url ? (
                <Button variant="outline" size="touch" onClick={() => window.open(open.sentry_url!, '_blank', 'noopener,noreferrer')}><ExternalLink />Open in Sentry</Button>
              ) : null}
              {canManage && open.status === 'new' ? <Button variant="outline" size="touch" loading={busy === `${open.id}:acknowledged`} onClick={() => void mark(open, 'acknowledged')}>Acknowledge</Button> : null}
              {canManage && open.status !== 'resolved' ? <Button size="touch" loading={busy === `${open.id}:resolved`} onClick={() => void mark(open, 'resolved')}>Mark resolved</Button> : null}
              {canManage && open.status === 'resolved' ? <Button variant="outline" size="touch" loading={busy === `${open.id}:new`} onClick={() => void mark(open, 'new')}>Reopen</Button> : null}
            </div>
          </div>
        </AdminSheet>
      ) : null}
    </>
  )
}
