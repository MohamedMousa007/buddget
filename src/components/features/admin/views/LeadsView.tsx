'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useAdminQuery } from '../adminClient'
import { ago, dateTime } from '../format'
import { AdminSheet } from '../ui/AdminSheet'
import { DataTable, type Column } from '../ui/DataTable'
import { Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'

interface Lead { id: string; kind: 'waitlist' | 'contact'; email: string | null; name: string | null; message: string | null; locale: string; created_at: string }

const KIND_FILTERS = [{ value: '', label: 'All' }, { value: 'contact', label: 'Messages' }, { value: 'waitlist', label: 'Waitlist' }]

/** Website contact messages and waitlist sign-ups, read-only. Built from DataTable, AdminSheet, Panel and SegmentedControl; rows are deleted after 180 days. */
export default function LeadsView() {
  const [kind, setKind] = useState('')
  const [open, setOpen] = useState<Lead | null>(null)
  const { data, error, loading } = useAdminQuery<{ rows: Lead[] }>(`/api/admin/leads${kind ? `?kind=${kind}` : ''}`)

  const columns: Column<Lead>[] = [
    { key: 'who', header: 'From', cell: (l) => <div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--color-brand-text-primary)]">{l.name ?? l.email ?? '-'}</p>{l.name ? <p className="truncate text-xs text-[var(--color-brand-text-muted)]">{l.email}</p> : null}</div> },
    { key: 'kind', header: 'Type', cell: (l) => <Pill tone={l.kind === 'contact' ? 'brand' : 'neutral'}>{l.kind === 'contact' ? 'Message' : 'Waitlist'}</Pill> },
    { key: 'message', header: 'Message', wide: true, cell: (l) => <span className="line-clamp-1 text-[var(--color-brand-text-secondary)]">{l.message ?? '-'}</span> },
    { key: 'locale', header: 'Language', wide: true, cell: (l) => l.locale.toUpperCase() },
    { key: 'at', header: 'Received', cell: (l) => <span className="text-[var(--color-brand-text-secondary)]">{ago(l.created_at)}</span> },
  ]

  if (error && !data) return <Notice tone="negative">{error}</Notice>

  return (
    <>
      <PageHeader title="Website leads" description="Contact messages and waitlist sign-ups from the website. Each is deleted automatically after 180 days." />
      <Panel flush title="Leads" actions={<SegmentedControl ariaLabel="Lead type" fill={false} options={KIND_FILTERS} value={kind} onChange={setKind} />}>
        {!data && loading ? <div className="p-5"><Loading /></div> : (
          <DataTable rows={data?.rows ?? []} columns={columns} rowKey={(l) => l.id} onRowClick={setOpen}
            empty={<div className="px-5 py-12 text-center text-sm text-[var(--color-brand-text-muted)]">No website leads in the last 180 days.</div>} />
        )}
      </Panel>

      {open ? (
        <AdminSheet open title={open.name ?? open.email ?? 'Lead'} onClose={() => setOpen(null)}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Pill tone={open.kind === 'contact' ? 'brand' : 'neutral'}>{open.kind === 'contact' ? 'Message' : 'Waitlist'}</Pill>
              <Pill>{open.locale.toUpperCase()}</Pill>
            </div>
            <p className="text-sm text-[var(--color-brand-text-secondary)]">{open.email}</p>
            <p className="text-xs text-[var(--color-brand-text-muted)]">Received {dateTime(open.created_at)}</p>
            {open.message ? <p className="whitespace-pre-wrap rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] p-3 text-sm text-[var(--color-brand-text-secondary)]">{open.message}</p> : null}
          </div>
        </AdminSheet>
      ) : null}
    </>
  )
}
