'use client'

import { useMemo } from 'react'
import { useAdminQuery } from '../adminClient'
import { DataTable, type Column } from '../ui/DataTable'
import { KpiGrid, StatTile } from '../ui/Kpi'
import { Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import type { AdminStatus } from '../types'

interface Row { day: string; model: string; feature: string; calls: number; in_tokens: number; out_tokens: number; cost_usd_micro: number; active_users: number }
interface Price { model: string; in_usd_per_mtok: number; cached_usd_per_mtok: number; out_usd_per_mtok: number; source_note: string | null }
interface Data { spend: { costMicro: number; capUsd: number | null } | null; days: number; rows: Row[]; prices: Price[] }

const usd = (micro: number) => `$${(micro / 1e6).toFixed(micro >= 1e6 ? 2 : 4)}`

export default function AiCostView(_props: { status: AdminStatus }) {
  const { data, error } = useAdminQuery<Data>('/api/admin/ai/cost?days=30')
  const byModel = useMemo(() => {
    const m = new Map<string, { model: string; calls: number; cost: number }>()
    for (const r of data?.rows ?? []) {
      const cur = m.get(r.model) ?? { model: r.model, calls: 0, cost: 0 }
      cur.calls += Number(r.calls)
      cur.cost += Number(r.cost_usd_micro)
      m.set(r.model, cur)
    }
    return [...m.values()].sort((a, b) => b.cost - a.cost)
  }, [data])
  if (error && !data) return <Notice tone="negative">{error}</Notice>
  if (!data) return <Loading rows={6} />

  const total = data.rows.reduce((a, r) => a + Number(r.cost_usd_micro), 0)
  const calls = data.rows.reduce((a, r) => a + Number(r.calls), 0)
  const today = data.rows.filter((r) => r.day === data.rows[0]?.day).reduce((a, r) => a + Number(r.cost_usd_micro), 0)

  const columns: Column<Row>[] = [
    { key: 'day', header: 'Day', cell: (r) => r.day },
    { key: 'model', header: 'Model', cell: (r) => r.model },
    { key: 'feature', header: 'Feature', cell: (r) => r.feature },
    { key: 'calls', header: 'Calls', numeric: true, cell: (r) => Number(r.calls).toLocaleString() },
    { key: 'users', header: 'Users', numeric: true, wide: true, cell: (r) => Number(r.active_users).toLocaleString() },
    { key: 'cost', header: 'Cost', numeric: true, cell: (r) => usd(Number(r.cost_usd_micro)) },
  ]
  const modelColumns: Column<(typeof byModel)[number]>[] = [
    { key: 'model', header: 'Model', cell: (r) => r.model },
    { key: 'calls', header: 'Calls', numeric: true, cell: (r) => r.calls.toLocaleString() },
    { key: 'cost', header: 'Cost', numeric: true, cell: (r) => usd(r.cost) },
  ]

  return (
    <>
      <PageHeader title="AI cost" description={`Last ${data.days} days, in USD. Cost uses the price book below at the time of each call.`} />
      {data.spend?.capUsd ? <div className="mb-4"><Notice tone={Number(data.spend.costMicro) / 1e6 >= data.spend.capUsd ? 'negative' : Number(data.spend.costMicro) / 1e6 >= data.spend.capUsd * 0.8 ? 'warning' : 'info'}>Today: {usd(Number(data.spend.costMicro))} of the {`$${data.spend.capUsd}`} daily cap. At 100% chat, voice, budget and goals pause; bank-text and receipt capture keep working.</Notice></div> : <div className="mb-4"><Notice>No daily cap is set. Add a platform setting <code>ai_spend_guard</code> with <code>{'{"dailyCapUsd": 10}'}</code> to turn the guardrail on.</Notice></div>}
      <KpiGrid cols={3}>
        <StatTile label="Total spend" value={usd(total)} sub={`${calls.toLocaleString()} calls`} />
        <StatTile label="Latest day" value={usd(today)} sub={data.rows[0]?.day ?? 'No data'} />
        <StatTile label="Per call" value={calls ? usd(total / calls) : '$0'} sub="average" />
      </KpiGrid>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="By model" flush><DataTable rows={byModel} columns={modelColumns} rowKey={(r) => r.model} /></Panel>
        <Panel title="Price book" description="Per million tokens. Seeded from public list prices: confirm against your provider invoice.">
          <ul className="divide-y divide-[var(--color-brand-border)] text-sm">
            {data.prices.map((p) => (
              <li key={p.model} className="py-2"><span className="font-medium">{p.model}</span> <span className="text-[var(--color-brand-text-muted)]">in ${p.in_usd_per_mtok} · cached ${p.cached_usd_per_mtok} · out ${p.out_usd_per_mtok}</span></li>
            ))}
          </ul>
        </Panel>
      </div>
      <div className="mt-6"><Panel title="By day, model and feature" flush><DataTable rows={data.rows} columns={columns} rowKey={(r) => `${r.day}|${r.model}|${r.feature}`} /></Panel></div>
    </>
  )
}
