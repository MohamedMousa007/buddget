'use client'

import { AlertTriangle, CheckCircle2, CreditCard, LifeBuoy, MessageSquareText, RefreshCw, Smartphone, TrendingUp, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { adminNavigate } from '../adminRouter'
import { useAdminQuery } from '../adminClient'
import { ago, compact, num, pct } from '../format'
import { BarList, CHART, Legend, StackedBars, TrendChart } from '../ui/Charts'
import { Delta, KpiGrid, StatTile } from '../ui/Kpi'
import { Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import { Pill } from '../ui/Pill'
import type { AdminStatus, DailyPoint } from '../types'

interface OverviewData {
  generatedAt: string
  overview: {
    users_total: number; users_new_7d: number; users_prev_7d: number; users_new_30d: number; users_banned: number
    dau: number; wau: number; mau: number; expenses_total: number; expenses_7d: number
    sms_enabled_users: number; push_devices: number; platforms: Record<string, number>
    sms_24h: { total: number; parsed: number; failed: number; rejected: number; pending: number }
    sms_7d: { total: number; parsed: number; failed: number }
    tickets: { open: number; pending: number; urgent: number; unassigned: number }
    plans: Array<{ plan: string; status: string; users: number }>
  }
  signups: Array<{ day: string; signups: number }>
  activity: Array<{ day: string; active_users: number; sessions: number }>
  sms: { total: number; parsed: number; failed: number; rejected: number; undelivered: number; daily: Array<{ day: string; total: number; parsed: number; failed: number }> }
  adoption: Record<string, number>
}

const ADOPTION_LABELS: Array<[string, string]> = [
  ['expenses', 'Logged an expense'], ['income', 'Set up income'], ['budgets', 'Created a budget'], ['sms', 'Imported an SMS'],
  ['push', 'Enabled push'], ['savings', 'Has savings'], ['debts', 'Tracks debts'], ['subscriptions', 'Tracks subscriptions'],
  ['goals', 'Set a goal'], ['receipts', 'Scanned a receipt'], ['biometric', 'Uses biometrics'],
]

export default function OverviewView({ status }: { status: AdminStatus }) {
  const { data, error, loading, refresh } = useAdminQuery<OverviewData>('/api/admin/overview')
  const perms = new Set(status.permissions ?? [])
  const can = (p: string) => perms.has('*') || perms.has(p)

  if (error && !data) return <Notice tone="negative">{error}</Notice>
  if (!data) return <Loading rows={8} />

  const { overview: o, sms, adoption } = data
  const attention: Array<{ tone: 'warning' | 'negative'; text: string; go?: [string, Record<string, string>?] }> = []
  if (o.sms_24h.failed > 0) attention.push({ tone: 'negative', text: `${o.sms_24h.failed} SMS failed to import in the last 24 hours`, go: ['sms', { tab: 'errors' }] })
  if (sms.undelivered > 0) attention.push({ tone: 'warning', text: `${sms.undelivered} parsed SMS never reached the app`, go: ['sms', { tab: 'errors' }] })
  if (o.tickets.urgent > 0) attention.push({ tone: 'negative', text: `${o.tickets.urgent} urgent ticket${o.tickets.urgent > 1 ? 's' : ''} open`, go: ['support'] })
  if (o.tickets.unassigned > 0) attention.push({ tone: 'warning', text: `${o.tickets.unassigned} ticket${o.tickets.unassigned > 1 ? 's' : ''} without an owner`, go: ['support'] })
  if (o.users_banned > 0) attention.push({ tone: 'warning', text: `${o.users_banned} suspended account${o.users_banned > 1 ? 's' : ''}`, go: ['users', { state: 'banned' }] })

  const smsRate = o.sms_7d.total ? o.sms_7d.parsed / o.sms_7d.total : 0
  const plansLive = o.plans.length > 0

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Live snapshot of the whole business · updated ${ago(data.generatedAt)}`}
        actions={<Button variant="outline" size="touch" loading={loading} onClick={() => void refresh()}><RefreshCw />Refresh</Button>}
      />

      <div className="space-y-6">
        {attention.length > 0 ? (
          <Panel title="Needs attention" description="Things a person should look at today">
            <ul className="space-y-2">
              {attention.map((a) => (
                <li key={a.text}>
                  <Notice tone={a.tone}>
                    <span className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2"><AlertTriangle className="size-4 shrink-0" aria-hidden />{a.text}</span>
                      {a.go ? <Button variant="ghost" size="sm" onClick={() => adminNavigate(a.go![0], a.go![1])}>Open</Button> : null}
                    </span>
                  </Notice>
                </li>
              ))}
            </ul>
          </Panel>
        ) : (
          <Notice tone="positive"><span className="flex items-center gap-2"><CheckCircle2 className="size-4" aria-hidden />All clear — nothing needs attention right now.</span></Notice>
        )}

        <KpiGrid cols={5}>
          <StatTile label="Total users" value={num(o.users_total)} icon={<Users className="size-4" />} sub={`${o.users_new_30d} joined in 30 days`} />
          <StatTile label="New this week" value={num(o.users_new_7d)} icon={<TrendingUp className="size-4" />} trailing={<Delta current={o.users_new_7d} previous={o.users_prev_7d} />} sub="vs the week before" />
          <StatTile label="Active today" value={num(o.dau)} icon={<Smartphone className="size-4" />} sub={`${num(o.wau)} this week · ${num(o.mau)} this month`} />
          <StatTile label="SMS import rate" value={pct(o.sms_7d.parsed, o.sms_7d.total)} icon={<MessageSquareText className="size-4" />} tone={smsRate >= 0.9 ? 'positive' : 'default'} sub={`${num(o.sms_7d.total)} SMS in 7 days`} onClick={can('sms.view') ? () => adminNavigate('sms') : undefined} />
          <StatTile label="Open tickets" value={num(o.tickets.open + o.tickets.pending)} icon={<LifeBuoy className="size-4" />} tone={o.tickets.urgent ? 'negative' : 'default'} sub={`${o.tickets.unassigned} unassigned`} onClick={can('support.view') ? () => adminNavigate('support') : undefined} />
        </KpiGrid>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Signups" description="New accounts per day, last 30 days">
            <TrendChart data={data.signups as DailyPoint[]} series={[{ key: 'signups', label: 'Signups', color: CHART.one }]} />
          </Panel>
          <Panel title="Activity" description="Daily active users and app sessions">
            <div className="space-y-2">
              <TrendChart data={data.activity as DailyPoint[]} series={[{ key: 'active_users', label: 'Active users', color: CHART.one }, { key: 'sessions', label: 'Sessions', color: CHART.four }]} />
              <Legend series={[{ key: 'a', label: 'Active users', color: CHART.one }, { key: 'b', label: 'Sessions', color: CHART.four }]} />
            </div>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="SMS pipeline" description="Last 7 days" actions={can('sms.view') ? <Button variant="ghost" size="sm" onClick={() => adminNavigate('sms')}>Details</Button> : undefined} className="xl:col-span-2">
            <div className="space-y-3">
              <StackedBars height={180} data={sms.daily as DailyPoint[]} series={[{ key: 'parsed', label: 'Imported', color: CHART.one }, { key: 'failed', label: 'Failed', color: CHART.three }]} />
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="good">{num(sms.parsed)} imported</Pill>
                <Pill tone={sms.failed ? 'bad' : 'neutral'}>{num(sms.failed)} failed</Pill>
                <Pill>{num(sms.rejected)} ignored</Pill>
                <Pill tone={sms.undelivered ? 'warn' : 'neutral'}>{num(sms.undelivered)} undelivered</Pill>
              </div>
            </div>
          </Panel>

          <Panel title="Where users are" description="Users with push enabled, by platform">
            <BarList items={Object.entries(o.platforms).map(([label, value]) => ({ label: label === 'ios' ? 'iOS' : label === 'android' ? 'Android' : label, value })).sort((a, b) => b.value - a.value)} color={CHART.five} />
            <p className="mt-4 text-xs text-[var(--color-brand-text-muted)]">{num(o.push_devices)} registered devices · {num(o.sms_enabled_users)} users with SMS tracking on</p>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="Feature adoption" description="Share of users who have used each area" className="xl:col-span-2">
            <BarList
              items={ADOPTION_LABELS.map(([key, label]) => ({ label, value: adoption[key] ?? 0, hint: pct(adoption[key] ?? 0, adoption.total_users) })).sort((a, b) => b.value - a.value)}
              format={compact}
            />
          </Panel>

          <Panel title="Monetization" description="Memberships and trials" actions={can('billing.view') ? <Button variant="ghost" size="sm" onClick={() => adminNavigate('plans')}>Manage</Button> : undefined}>
            {plansLive ? (
              <ul className="space-y-2 text-sm">
                {o.plans.map((p) => (
                  <li key={`${p.plan}-${p.status}`} className="flex items-center justify-between">
                    <span className="flex items-center gap-2"><CreditCard className="size-4 text-[var(--color-brand-text-muted)]" aria-hidden />{p.plan}<Pill tone={p.status === 'active' ? 'good' : p.status === 'trialing' ? 'brand' : 'neutral'}>{p.status}</Pill></span>
                    <span className="font-mono-numbers tabular-nums">{p.users}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--color-brand-text-secondary)]">Everyone is on the free plan. Memberships, trials and loyalty tiers will show here once billing goes live.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
