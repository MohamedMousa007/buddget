'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import { Switch } from '@/components/ui/switch'
import { useAdminQuery } from '../adminClient'
import { ago } from '../format'
import { useAdminAction } from '../useAdminAction'
import { AdminSheet } from '../ui/AdminSheet'
import { DataTable, type Column } from '../ui/DataTable'
import { Field } from '../ui/Field'
import { Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import type { AdminStatus } from '../types'

interface Flag { key: string; description: string; enabled: boolean; rollout_pct: number; plan_keys: string[]; platforms: string[]; updated_at: string }
interface FlagsData { flags: Flag[]; plans: Array<{ key: string; name: string }> }

const PLATFORMS = ['ios', 'android', 'web']
const BLANK: Flag = { key: '', description: '', enabled: false, rollout_pct: 100, plan_keys: [], platforms: [], updated_at: '' }

export default function FlagsView({ status }: { status: AdminStatus }) {
  const { data, error, loading, refresh } = useAdminQuery<FlagsData>('/api/admin/flags')
  const { run, busy } = useAdminAction('/api/admin/flags', refresh)
  const [editing, setEditing] = useState<{ flag: Flag; isNew: boolean } | null>(null)
  const canManage = (status.permissions ?? []).some((p) => p === '*' || p === 'flags.manage')

  const save = (f: Flag) => run('save', { op: 'upsert', flag: { key: f.key, description: f.description, enabled: f.enabled, rolloutPct: f.rollout_pct, planKeys: f.plan_keys, platforms: f.platforms } }, { success: 'Flag saved' })

  const columns: Column<Flag>[] = [
    { key: 'key', header: 'Flag', cell: (f) => <div className="min-w-0"><p className="font-mono text-sm font-medium text-[var(--color-brand-text-primary)]">{f.key}</p>{f.description ? <p className="truncate text-xs text-[var(--color-brand-text-muted)]">{f.description}</p> : null}</div> },
    { key: 'on', header: 'On', cell: (f) => <Switch checked={f.enabled} disabled={!canManage} aria-label={`Toggle ${f.key}`} onCheckedChange={(v) => void save({ ...f, enabled: v })} /> },
    { key: 'rollout', header: 'Rollout', numeric: true, cell: (f) => `${f.rollout_pct}%` },
    { key: 'scope', header: 'Scope', cell: (f) => <span className="flex flex-wrap gap-1">{f.platforms.length === 0 && f.plan_keys.length === 0 ? <Pill>Everyone</Pill> : null}{f.platforms.map((p) => <Pill key={p} tone="brand">{p}</Pill>)}{f.plan_keys.map((p) => <Pill key={p}>{p}</Pill>)}</span> },
    { key: 'updated', header: 'Changed', wide: true, cell: (f) => <span className="text-[var(--color-brand-text-secondary)]">{ago(f.updated_at)}</span> },
    { key: 'actions', header: '', cell: (f) => canManage ? <IconButton aria-label={`Delete ${f.key}`} variant="danger" size="sm" hitArea={false} onClick={() => void run('del', { op: 'delete', key: f.key }, { success: 'Flag deleted', confirm: { title: `Delete ${f.key}?`, body: 'Anything reading this flag falls back to its default.', destructive: true } })}><Trash2 /></IconButton> : null },
  ]

  if (error && !data) return <Notice tone="negative">{error}</Notice>

  return (
    <>
      <PageHeader title="Feature flags" description="Roll features out gradually, gate them by plan or platform, and switch them off instantly." actions={canManage ? <Button size="touch" onClick={() => setEditing({ flag: BLANK, isNew: true })}><Plus />New flag</Button> : undefined} />
      <Panel flush>
        {!data && loading ? <div className="p-5"><Loading /></div> : (
          <DataTable rows={data?.flags ?? []} columns={columns} rowKey={(f) => f.key} onRowClick={canManage ? (f) => setEditing({ flag: f, isNew: false }) : undefined}
            empty={<div className="px-5 py-12 text-center text-sm text-[var(--color-brand-text-muted)]">No flags yet. Create one to start a gradual rollout — e.g. <code>premium.reports</code> at 10%.</div>} />
        )}
      </Panel>

      {editing ? (
        <AdminSheet open title={editing.isNew ? 'New flag' : editing.flag.key} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            {editing.isNew ? <Field label="Key" hint="Lowercase letters, numbers, dots, dashes and underscores."><Input size="brand" value={editing.flag.key} onChange={(e) => setEditing({ ...editing, flag: { ...editing.flag, key: e.target.value.toLowerCase() } })} className="font-mono" /></Field> : null}
            <Field label="Description"><Input size="brand" value={editing.flag.description} onChange={(e) => setEditing({ ...editing, flag: { ...editing.flag, description: e.target.value } })} /></Field>
            <div className="flex items-center justify-between"><span className="text-sm">Enabled</span><Switch size="touch" checked={editing.flag.enabled} onCheckedChange={(v) => setEditing({ ...editing, flag: { ...editing.flag, enabled: v } })} aria-label="Enabled" /></div>
            <Field label={`Rollout · ${editing.flag.rollout_pct}% of users`}>
              <input type="range" min={0} max={100} step={5} value={editing.flag.rollout_pct} onChange={(e) => setEditing({ ...editing, flag: { ...editing.flag, rollout_pct: Number(e.target.value) } })} className="w-full accent-[var(--color-brand-primary)]" />
            </Field>
            <div><p className="mb-2 text-xs font-medium text-[var(--color-brand-text-secondary)]">Platforms (none = all)</p><div className="flex flex-wrap gap-2">{PLATFORMS.map((p) => <OptionChip key={p} selected={editing.flag.platforms.includes(p)} onClick={() => setEditing({ ...editing, flag: { ...editing.flag, platforms: toggle(editing.flag.platforms, p) } })}>{p}</OptionChip>)}</div></div>
            {data?.plans.length ? <div><p className="mb-2 text-xs font-medium text-[var(--color-brand-text-secondary)]">Plans (none = all)</p><div className="flex flex-wrap gap-2">{data.plans.map((p) => <OptionChip key={p.key} selected={editing.flag.plan_keys.includes(p.key)} onClick={() => setEditing({ ...editing, flag: { ...editing.flag, plan_keys: toggle(editing.flag.plan_keys, p.key) } })}>{p.name}</OptionChip>)}</div></div> : null}
            <Button size="cta-block" loading={busy === 'save'} disabled={!editing.flag.key} onClick={async () => { if (await save(editing.flag)) setEditing(null) }}>Save flag</Button>
          </div>
        </AdminSheet>
      ) : null}
    </>
  )
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
