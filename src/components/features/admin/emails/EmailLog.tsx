'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import { EMAIL_LOCALES, LOCALE_LABEL } from '@/lib/email/scenarios'
import { adminFetch, errorMessage } from '../adminClient'
import { dateTime, pct } from '../format'
import { AdminSheet } from '../ui/AdminSheet'
import { DataTable, type Column } from '../ui/DataTable'
import { Field, Toolbar } from '../ui/Field'
import { KpiGrid, StatTile } from '../ui/Kpi'
import { KeyValue, Notice, Panel } from '../ui/Panel'
import { StatusPill } from '../ui/Pill'
import type { ScenarioSummary } from './types'

interface LogRow { id: string; created_at: string; to_email: string; template_key: string; locale: string; provider_message_id: string | null; status: string; error: string | null; latency_ms: number | null; source: string; is_test: boolean }
interface LogData { rows: LogRow[]; nextCursor: string | null; counts: Record<string, number>; total: number; failureRate: number; searchEnabled: boolean }

const STATUSES = ['sent', 'delivered', 'bounced', 'complained', 'failed'] as const

const STATUS_PILL: Record<string, string> = { complained: 'failed', bounced: 'failed' }

export function EmailLog({ scenarios }: { scenarios: ScenarioSummary[] }) {
  const [filters, setFilters] = useState({ template: '', status: '', locale: '', from: '', to: '', q: '' })
  const [applied, setApplied] = useState(filters)
  const [data, setData] = useState<LogData | null>(null)
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<LogRow | null>(null)

  const load = useCallback(async (cursor: string | null) => {
    setLoading(true)
    try {
      const p = new URLSearchParams()
      for (const [k, v] of Object.entries(applied)) if (v) p.set(k, k === 'from' || k === 'to' ? new Date(v + (k === 'to' ? 'T23:59:59' : 'T00:00:00')).toISOString() : v)
      if (cursor) p.set('cursor', cursor)
      const res = await adminFetch<LogData>(`/api/admin/emails/log?${p}`)
      setData(res)
      setRows((prev) => (cursor ? [...prev, ...res.rows] : res.rows))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [applied])

  useEffect(() => {
    void load(null)
  }, [load])

  const columns: Column<LogRow>[] = [
    { key: 'when', header: 'When', cell: (r) => <span className="whitespace-nowrap text-[var(--color-brand-text-secondary)]">{dateTime(r.created_at)}</span> },
    { key: 'to', header: 'To', cell: (r) => <span className="text-[var(--color-brand-text-primary)]">{r.to_email}{r.is_test ? ' · test' : ''}</span> },
    { key: 'tpl', header: 'Email', cell: (r) => <span className="font-mono text-xs">{r.template_key}</span> },
    { key: 'loc', header: 'Language', wide: true, cell: (r) => LOCALE_LABEL[r.locale as 'en' | 'ar'] ?? r.locale },
    { key: 'status', header: 'Status', cell: (r) => <StatusPill status={STATUS_PILL[r.status] ?? r.status} /> },
    { key: 'ms', header: 'Time', numeric: true, wide: true, cell: (r) => (r.latency_ms == null ? '—' : `${r.latency_ms} ms`) },
  ]

  return (
    <div className="space-y-4">
      {data ? (
        <KpiGrid cols={4}>
          <StatTile label="Total" value={String(data.total)} />
          <StatTile label="Delivered" value={String(data.counts.delivered ?? 0)} />
          <StatTile label="Failure rate" value={pct(data.failureRate * data.total, data.total, 1)} />
          <StatTile label="Bounced or complained" value={String((data.counts.bounced ?? 0) + (data.counts.complained ?? 0))} />
        </KpiGrid>
      ) : null}
      <Panel flush>
        <Toolbar>
          <form className="flex flex-1 flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); setApplied({ ...filters, q: filters.q.trim() }) }}>
            <Field label="Email" className="min-w-[160px] flex-1">
              <select aria-label="Email" value={filters.template} onChange={(e) => setFilters({ ...filters, template: e.target.value })} className="h-10 w-full rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-elevated)] px-3 text-sm text-[var(--color-brand-text-primary)]">
                <option value="">All</option>
                {scenarios.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="From"><Input type="date" className="h-10" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></Field>
            <Field label="To"><Input type="date" className="h-10" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></Field>
            <Field label="Recipient" className="min-w-[180px] flex-1"><Input aria-label="Recipient" className="h-10" disabled={data ? !data.searchEnabled : false} placeholder={data && !data.searchEnabled ? 'Needs PII access' : 'Search by email'} value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} /></Field>
            <Button type="submit" variant="outline" size="touch">Filter</Button>
          </form>
          <div className="flex w-full flex-wrap gap-2">
            <OptionChip size="sm" selected={!applied.status} onClick={() => { setFilters({ ...filters, status: '' }); setApplied({ ...applied, status: '' }) }}>All</OptionChip>
            {STATUSES.map((s) => (
              <OptionChip key={s} size="sm" selected={applied.status === s} onClick={() => { setFilters({ ...filters, status: s }); setApplied({ ...applied, status: s }) }}>{s} · {data?.counts[s] ?? 0}</OptionChip>
            ))}
            {EMAIL_LOCALES.map((l) => (
              <OptionChip key={l} size="sm" selected={applied.locale === l} onClick={() => { const next = applied.locale === l ? '' : l; setFilters({ ...filters, locale: next }); setApplied({ ...applied, locale: next }) }}>{LOCALE_LABEL[l]}</OptionChip>
            ))}
          </div>
        </Toolbar>
        {error ? <div className="p-5"><Notice tone="negative">{error}</Notice></div> : null}
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} loading={loading} onRowClick={setOpen} empty={<div className="px-5 py-12 text-center text-sm text-[var(--color-brand-text-muted)]">No emails match.</div>} />
        {data?.nextCursor ? <div className="border-t border-[var(--color-brand-border)] p-4"><Button variant="outline" size="touch" className="w-full" loading={loading} onClick={() => void load(data.nextCursor)}>Load older</Button></div> : null}
      </Panel>

      {open ? (
        <AdminSheet open title="Send details" onClose={() => setOpen(null)}>
          <dl className="divide-y divide-[var(--color-brand-border)]">
            <KeyValue label="To">{open.to_email}</KeyValue>
            <KeyValue label="Email" mono>{open.template_key}</KeyValue>
            <KeyValue label="Language">{LOCALE_LABEL[open.locale as 'en' | 'ar'] ?? open.locale}</KeyValue>
            <KeyValue label="Status"><StatusPill status={STATUS_PILL[open.status] ?? open.status} /></KeyValue>
            <KeyValue label="Source">{open.source.replace('_', ' ')}</KeyValue>
            <KeyValue label="Time taken">{open.latency_ms == null ? '—' : `${open.latency_ms} ms`}</KeyValue>
            <KeyValue label="Sent">{dateTime(open.created_at)}</KeyValue>
            <KeyValue label="Provider id" mono>{open.provider_message_id ?? '—'}</KeyValue>
          </dl>
          {open.error ? <div className="mt-4"><Notice tone="negative">{open.error}</Notice></div> : null}
        </AdminSheet>
      ) : null}
    </div>
  )
}
