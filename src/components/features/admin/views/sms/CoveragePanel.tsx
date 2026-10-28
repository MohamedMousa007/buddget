'use client'

import { useAdminQuery } from '../../adminClient'
import { pct } from '../../format'
import { DataTable } from '../../ui/DataTable'
import { Loading, Notice, Panel } from '../../ui/Panel'
import { Pill } from '../../ui/Pill'
import { share, type CoverageRow } from '@/lib/admin/patternReview'

const COVERAGE_PATH = '/api/admin/sms/pattern-review?view=coverage'
const whole = (part: number, total: number) => pct(part, total)

export function CoveragePanel() {
  const { data, error } = useAdminQuery<{ available: boolean; rows: CoverageRow[] }>(COVERAGE_PATH)
  if (error && !data) return <Notice tone="negative">{error}</Notice>
  if (!data) return <Loading rows={6} />
  if (!data.available) return <Notice tone="info">Coverage data is not available yet. It arrives with migration 0211.</Notice>
  return (
    <Panel title="Coverage by bank" description="Share of each bank’s messages handled by the curated, template and AI tiers, plus the failure rate and the most common unlearned shapes (masked)." flush>
      <DataTable
        rows={data.rows}
        rowKey={(r) => r.bank}
        empty={<p className="p-5 text-sm text-[var(--color-brand-text-muted)]">No messages in the window.</p>}
        columns={[
          { key: 'bank', header: 'Bank / sender', cell: (r) => <span className="font-medium">{r.bank}</span> },
          { key: 'total', header: 'Messages', numeric: true, cell: (r) => r.total },
          { key: 'curated', header: 'Curated', numeric: true, cell: (r) => whole(r.curated, r.total) },
          { key: 'template', header: 'Template', numeric: true, cell: (r) => whole(r.template, r.total) },
          { key: 'ai', header: 'AI', numeric: true, cell: (r) => <Pill tone={share(r.ai, r.total) > 0.3 ? 'warn' : 'neutral'}>{whole(r.ai, r.total)}</Pill> },
          { key: 'failed', header: 'Failure', numeric: true, cell: (r) => <Pill tone={share(r.failed, r.total) > 0.1 ? 'bad' : 'neutral'}>{whole(r.failed, r.total)}</Pill> },
          { key: 'top', header: 'Top unlearned shapes', wide: true, cell: (r) => r.top_unlearned.length ? <code className="block max-w-md truncate text-xs">{r.top_unlearned.join(' | ')}</code> : '—' },
        ]}
      />
    </Panel>
  )
}
