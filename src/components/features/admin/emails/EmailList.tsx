'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { CUSTOM_KEY_RE, EMAIL_LOCALES, LOCALE_LABEL } from '@/lib/email/scenarios'
import { useAdminQuery } from '../adminClient'
import { ago } from '../format'
import { useAdminAction } from '../useAdminAction'
import { AdminSheet } from '../ui/AdminSheet'
import { DataTable, type Column } from '../ui/DataTable'
import { Field } from '../ui/Field'
import { Loading, Notice, Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import type { ScenarioSummary } from './types'

const STATE_TONE = { published: 'good', draft: 'warn', none: 'neutral' } as const
const STATE_LABEL = { published: 'Published', draft: 'Draft', none: 'Not set up' } as const

export function EmailList({ canManage, onOpen }: { canManage: boolean; onOpen: (key: string) => void }) {
  const { data, error, loading, refresh } = useAdminQuery<{ scenarios: ScenarioSummary[] }>('/api/admin/emails')
  const { run, busy } = useAdminAction('/api/admin/emails', refresh)
  const [creating, setCreating] = useState<{ key: string; name: string; description: string } | null>(null)

  const columns: Column<ScenarioSummary>[] = [
    { key: 'name', header: 'Email', cell: (s) => <div className="min-w-0"><p className="font-medium text-[var(--color-brand-text-primary)]">{s.name}</p><p className="truncate font-mono text-xs text-[var(--color-brand-text-muted)]">{s.key}</p></div> },
    { key: 'used', header: 'Used for', wide: true, cell: (s) => <span className="text-[var(--color-brand-text-secondary)]">{s.usedIn}</span> },
    ...EMAIL_LOCALES.map((l): Column<ScenarioSummary> => ({
      key: l,
      header: LOCALE_LABEL[l],
      cell: (s) => <Pill tone={STATE_TONE[s.locales[l].state]}>{STATE_LABEL[s.locales[l].state]}{s.locales[l].version ? ` v${s.locales[l].version}` : ''}</Pill>,
    })),
    { key: 'edited', header: 'Last edited', wide: true, cell: (s) => <span className="text-[var(--color-brand-text-secondary)]">{ago(EMAIL_LOCALES.map((l) => s.locales[l].updatedAt).filter(Boolean).sort().pop())}</span> },
    { key: 'actions', header: '', cell: (s) => s.custom && canManage ? <IconButton aria-label={`Delete ${s.name}`} variant="danger" size="sm" hitArea={false} onClick={(e) => { e.stopPropagation(); void run('del', { op: 'deleteScenario', key: s.key }, { success: 'Email deleted', confirm: { title: `Delete ${s.name}?`, body: 'Its templates and history go with it. Code that sends it will fall back to nothing.', destructive: true } }) }}><Trash2 /></IconButton> : null },
  ]

  if (error && !data) return <Notice tone="negative">{error}</Notice>

  return (
    <>
      <Panel
        flush
        title="Emails"
        description="Every transactional email Buddget sends. Variables available and where each one is used are listed per email."
        actions={canManage ? <Button size="touch" onClick={() => setCreating({ key: '', name: '', description: '' })}><Plus />New email</Button> : undefined}
      >
        {!data && loading ? <div className="p-5"><Loading /></div> : (
          <DataTable rows={data?.scenarios ?? []} columns={columns} rowKey={(s) => s.key} onRowClick={(s) => onOpen(s.key)} />
        )}
      </Panel>

      {creating ? (
        <AdminSheet open title="New email" onClose={() => setCreating(null)}>
          <div className="space-y-4">
            <Field label="Name"><Input size="brand" value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} /></Field>
            <Field label="Key" hint="Used from code: sendTemplatedEmail('key', user, vars). Lowercase letters, numbers, underscores."><Input size="brand" className="font-mono" value={creating.key} onChange={(e) => setCreating({ ...creating, key: e.target.value.toLowerCase() })} /></Field>
            <Field label="What it is for"><Input size="brand" value={creating.description} onChange={(e) => setCreating({ ...creating, description: e.target.value })} /></Field>
            <Button size="cta-block" loading={busy === 'create'} disabled={!creating.name.trim() || !CUSTOM_KEY_RE.test(creating.key)} onClick={async () => { if (await run('create', { op: 'createScenario', ...creating }, { success: 'Email created' })) { const k = creating.key; setCreating(null); onOpen(k) } }}>Create</Button>
          </div>
        </AdminSheet>
      ) : null}
    </>
  )
}
