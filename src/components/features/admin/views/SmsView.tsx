'use client'

import { AlertTriangle } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { adminNavigate, useAdminRoute } from '../adminRouter'
import { useAdminQuery } from '../adminClient'
import { num, pct } from '../format'
import { BarList, CHART, Legend, StackedBars } from '../ui/Charts'
import { KpiGrid, StatTile } from '../ui/Kpi'
import { Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import type { AdminStatus, DailyPoint } from '../types'
import { FAILURE_LABELS, METHOD } from '../smsDisplay'
import { KeywordPoolPanel } from './sms/KeywordPoolPanel'
import { PromotionPanel } from './sms/PromotionPanel'
import { SmsLogPanel } from './sms/SmsLogPanel'
import { TemplatesPanel } from './sms/TemplatesPanel'

const TABS = [
  { value: 'health', label: 'Health' }, { value: 'errors', label: 'Error queue' }, { value: 'tracked', label: 'Tracked SMS' },
  { value: 'templates', label: 'Templates' }, { value: 'promotion', label: 'Auto-promotion' }, { value: 'keywords', label: 'Keyword pool' },
] as const
type Tab = (typeof TABS)[number]['value']

interface Health {
  days: number
  health: {
    total: number; parsed: number; failed: number; rejected: number; undelivered: number; users: number
    by_method: Record<string, number>
    failure_codes: Array<{ code: string; count: number }>
    top_failing_senders: Array<{ sender: string; failed: number; total: number }>
    daily: Array<{ day: string; total: number; parsed: number; failed: number }>
  }
}

export default function SmsView({ status }: { status: AdminStatus }) {
  const route = useAdminRoute()
  const tab = (TABS.find((t) => t.value === route.params.tab)?.value ?? 'health') as Tab
  const perms = new Set(status.permissions ?? [])
  const can = (p: string) => perms.has('*') || perms.has(p)

  return (
    <>
      <PageHeader title="SMS pipeline" description="Automatic transaction import: delivery health, the error queue, and the templates that parse messages." />
      <div className="mb-5 overflow-x-auto">
        <SegmentedControl ariaLabel="SMS section" fill={false} options={TABS} value={tab} onChange={(v) => adminNavigate('sms', { tab: v })} />
      </div>
      {tab === 'health' ? <HealthTab /> : null}
      {tab === 'errors' ? <SmsLogPanel key="errors" queue="errors" canTicket={can('support.reply')} /> : null}
      {tab === 'tracked' ? <SmsLogPanel key={`all-${route.params.userId ?? ''}`} queue="all" userId={route.params.userId} canTicket={can('support.reply')} /> : null}
      {tab === 'templates' ? <TemplatesPanel canManage={can('sms.manage')} /> : null}
      {tab === 'promotion' ? <PromotionPanel canManage={can('sms.manage')} /> : null}
      {tab === 'keywords' ? <KeywordPoolPanel /> : null}
    </>
  )
}

function HealthTab() {
  const { data, error } = useAdminQuery<Health>('/api/admin/sms/health?days=7')
  const push = useAdminQuery<{ configured: boolean; tokens: number; byPlatform: Record<string, number> }>('/api/admin/sms/push-health')
  if (error && !data) return <Notice tone="negative">{error}</Notice>
  if (!data) return <Loading rows={6} />
  const h = data.health
  return (
    <div className="space-y-6">
      {push.data && !push.data.configured ? (
        <Notice tone="negative"><span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /><span><strong>Push delivery is down.</strong> <code>FIREBASE_SERVICE_ACCOUNT_JSON</code> is not set in the deployed environment, so nobody is receiving SMS push notifications.</span></span></Notice>
      ) : null}
      <KpiGrid>
        <StatTile label="SMS received · 7d" value={num(h.total)} sub={`${num(h.users)} users`} />
        <StatTile label="Import rate" value={pct(h.parsed, h.total)} tone={h.total && h.parsed / h.total >= 0.9 ? 'positive' : 'default'} sub={`${num(h.parsed)} imported`} />
        <StatTile label="Failed" value={num(h.failed)} tone={h.failed ? 'negative' : 'default'} sub={`${num(h.rejected)} ignored as non-transactions`} onClick={() => adminNavigate('sms', { tab: 'errors' })} />
        <StatTile label="Never reached app" value={num(h.undelivered)} tone={h.undelivered ? 'negative' : 'default'} sub="logged/pushed, not confirmed" onClick={() => adminNavigate('sms', { tab: 'errors' })} />
      </KpiGrid>
      <Panel title="Daily volume">
        <div className="space-y-2">
          <StackedBars data={h.daily as DailyPoint[]} series={[{ key: 'parsed', label: 'Imported', color: CHART.one }, { key: 'failed', label: 'Failed', color: CHART.three }]} />
          <Legend series={[{ key: 'p', label: 'Imported', color: CHART.one }, { key: 'f', label: 'Failed', color: CHART.three }]} />
        </div>
      </Panel>
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="How messages were parsed"><BarList items={Object.entries(h.by_method).map(([k, v]) => ({ label: METHOD[k]?.label ?? k, value: v })).sort((a, b) => b.value - a.value)} /></Panel>
        <Panel title="Why they failed"><BarList color={CHART.three} items={h.failure_codes.map((f) => ({ label: FAILURE_LABELS[f.code] ?? f.code, value: f.count }))} empty="No failure codes recorded." /></Panel>
        <Panel title="Senders that fail most"><BarList color={CHART.two} items={h.top_failing_senders.map((s) => ({ label: s.sender, value: s.failed, hint: `of ${s.total}` }))} empty="No failing senders." /></Panel>
      </div>
    </div>
  )
}
