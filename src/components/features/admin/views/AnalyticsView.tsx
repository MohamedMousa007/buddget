'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useAdminQuery } from '../adminClient'
import type { OnboardingFunnel } from '@/app/api/admin/analytics/onboarding/route'
import { compact, num, pct } from '../format'
import { BarList, CHART, Legend, RetentionGrid, TrendChart } from '../ui/Charts'
import { KpiGrid, StatTile } from '../ui/Kpi'
import { Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import type { DailyPoint } from '../types'

interface AnalyticsData {
  days: number
  signups: Array<{ day: string; signups: number }>
  activity: Array<{ day: string; active_users: number; sessions: number }>
  adoption: Record<string, number>
  retention: Array<{ cohort_week: string; size: number; active: Record<string, number> }>
  funnel: Array<{ milestone: string; users: number }>
  retentionDays: Record<'d1' | 'd7' | 'd30', { eligible: number; retained: number }>
  overview: { users_total: number; dau: number; wau: number; mau: number; users_new_30d: number }
}

const MILESTONES: Record<string, string> = {
  signed_up: 'Signed up', onboarding_done: 'Finished setup', first_account: 'Added an account', first_income: 'Added income',
  first_expense: 'Logged an expense', sms_enabled: 'Turned on bank texts', budget_created: 'Created a budget', goal_created: 'Created a goal',
}

const RANGES = [{ value: '14', label: '14d' }, { value: '30', label: '30d' }, { value: '90', label: '90d' }] as const

/** Activation funnel: each step is a stricter claim about the same users. */
const FUNNEL: Array<[string, string]> = [
  ['total_users', 'Signed up'], ['income', 'Set up income'], ['expenses', 'Logged an expense'], ['budgets', 'Created a budget'], ['sms', 'Auto-imported an SMS'],
]

export default function AnalyticsView() {
  const [range, setRange] = useState<'14' | '30' | '90'>('30')
  const { data, error } = useAdminQuery<AnalyticsData>(`/api/admin/analytics?days=${range}`)
  const { data: onboarding } = useAdminQuery<OnboardingFunnel>(`/api/admin/analytics/onboarding?days=${range}`)

  if (error && !data) return <Notice tone="negative">{error}</Notice>
  if (!data) return <Loading rows={8} />
  const { overview: o, adoption } = data
  const totalSignups = data.signups.reduce((n, d) => n + d.signups, 0)
  const avgDau = data.activity.length ? Math.round(data.activity.reduce((n, d) => n + d.active_users, 0) / data.activity.length) : 0

  return (
    <>
      <PageHeader
        title="Growth & engagement"
        description="Acquisition, activity, activation and retention"
        actions={<SegmentedControl ariaLabel="Date range" options={RANGES} value={range} onChange={setRange} fill={false} />}
      />
      <div className="space-y-6">
        <KpiGrid>
          <StatTile label={`Signups · ${range}d`} value={num(totalSignups)} sub={`${num(o.users_new_30d)} in the last 30 days`} />
          <StatTile label="Daily active (avg)" value={num(avgDau)} sub={`${num(o.dau)} today`} />
          <StatTile label="Stickiness (DAU/MAU)" value={pct(o.dau, o.mau)} sub={`${num(o.wau)} weekly · ${num(o.mau)} monthly`} />
          <StatTile label="Users" value={num(o.users_total)} sub="all time" />
        </KpiGrid>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Signups per day"><TrendChart data={data.signups as DailyPoint[]} series={[{ key: 'signups', label: 'Signups', color: CHART.one }]} /></Panel>
          <Panel title="Daily active users & sessions">
            <div className="space-y-2">
              <TrendChart data={data.activity as DailyPoint[]} series={[{ key: 'active_users', label: 'Active users', color: CHART.one }, { key: 'sessions', label: 'Sessions', color: CHART.four }]} />
              <Legend series={[{ key: 'a', label: 'Active users', color: CHART.one }, { key: 'b', label: 'Sessions', color: CHART.four }]} />
            </div>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Activation funnel" description="How far new users get">
            <BarList items={FUNNEL.map(([k, label]) => ({ label, value: adoption[k] ?? 0, hint: pct(adoption[k] ?? 0, adoption.total_users) }))} format={compact} />
          </Panel>
          <Panel title="Feature reach" description="Users who have used each area">
            <BarList
              color={CHART.four}
              items={[['debts', 'Debts'], ['savings', 'Savings'], ['subscriptions', 'Subscriptions'], ['goals', 'Goals'], ['receipts', 'Receipts'], ['push', 'Push'], ['biometric', 'Biometrics'], ['two_factor', 'Email 2FA'], ['ai_enabled', 'AI enabled']]
                .map(([k, label]) => ({ label: label!, value: adoption[k!] ?? 0, hint: pct(adoption[k!] ?? 0, adoption.total_users) }))
                .sort((a, b) => b.value - a.value)}
              format={compact}
            />
          </Panel>
        </div>

        {onboarding && onboarding.started > 0 ? (
          <Panel title="First-run journey" description={`${num(onboarding.started)} started · ${num(onboarding.completed)} finished · ${num(onboarding.left)} left`}>
            <div className="grid gap-6 xl:grid-cols-2">
              <BarList
                items={onboarding.steps.map((s) => ({ label: s.step, value: s.completed, hint: `${num(s.viewed)} viewed` }))}
                format={compact}
              />
              <BarList
                color={CHART.four}
                items={onboarding.permissions.filter((p) => p.granted !== null).map((p) => ({ label: `${p.kind} ${p.granted ? 'allowed' : 'declined'}`, value: p.users }))}
                format={compact}
              />
            </div>
          </Panel>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="New-user funnel" description="People who signed up in the last 30 days, by first-time milestone (updated nightly)">
            <BarList items={data.funnel.map((s) => ({ label: MILESTONES[s.milestone] ?? s.milestone, value: s.users, hint: pct(s.users, data.funnel[0]?.users ?? 0) }))} format={compact} />
          </Panel>
          <Panel title="Day 1, 7 and 30 retention" description="Of people who signed up in the last 90 days and are old enough, the share active exactly that many days later">
            <BarList
              color={CHART.four}
              items={(['d1', 'd7', 'd30'] as const).map((k) => ({ label: `Day ${k.slice(1)}`, value: data.retentionDays[k]?.retained ?? 0, hint: `${pct(data.retentionDays[k]?.retained ?? 0, data.retentionDays[k]?.eligible ?? 0)} of ${num(data.retentionDays[k]?.eligible ?? 0)}` }))}
              format={compact}
            />
          </Panel>
        </div>

        <Panel title="Weekly retention" description="Share of each signup cohort that was active N weeks later">
          <RetentionGrid cohorts={data.retention} />
        </Panel>
      </div>
    </>
  )
}
