'use client'

import { useState } from 'react'
import { ArrowLeft, Bell, Fingerprint, Mail, MailCheck, RotateCcw, ShieldAlert, Smartphone, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SelectField } from '@/components/ui/SelectField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { FEATURE_CATALOG, LIMIT_CATALOG, LIMIT_KEYS, type LimitKey } from '@/lib/entitlements/limits'
import { adminNavigate } from '../adminRouter'
import FinancialTab from './FinancialTab'
import { useAdminQuery } from '../adminClient'
import { ago, dateTime, num, personLabel } from '../format'
import { useAdminAction } from '../useAdminAction'
import { AdminSheet } from '../ui/AdminSheet'
import { Field } from '../ui/Field'
import { KeyValue, Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import { Pill, StatusPill } from '../ui/Pill'
import { useStepUp } from '../ui/StepUp'
import type { AdminStatus } from '../types'

interface Overview {
  auth: { id: string; email?: string; phone?: string; created_at: string; last_sign_in_at: string | null; email_confirmed_at: string | null; banned_until: string | null; providers: string[] }
  profile: { name: string | null; city?: string; country: string | null; base_currency: string | null; secondary_currency: string | null; phone?: string } | null
  settings: { language: string; theme: string; enable_ai: boolean; sms_tracking_enabled: boolean; two_factor_email_enabled: boolean; month_start_day: number } | null
  counts: Record<string, number>
  devices: { push: Array<{ platform: string; app_version: string | null; device_model: string | null; locale: string | null; updated_at: string }>; sms_tokens_active: number; trusted: number; biometric: number }
  activity: { last_event_at: string | null; sessions_30d: number; active_days_30d: number }
  entitlement: { plan_key: string; status: string; trial_ends_at: string | null; current_period_end: string | null; limit_overrides: Record<string, number | null>; feature_overrides: Record<string, boolean>; note: string | null; source: string } | null
  loyalty: { points_balance: number; lifetime_points: number; tier_key: string | null } | null
  notes: Array<{ id: string; author_label: string | null; body: string; pinned: boolean; created_at: string }>
  tickets: Array<{ id: string; number: number; subject: string; status: string; priority: string; created_at: string }>
  plans: Array<{ key: string; name: string; status: string; is_default: boolean; trial_days: number }>
  staffRole: string | null
  loyaltyLedger: Array<{ id: number; delta: number; reason: string; created_at: string }>
}

interface TimelineEvent { at: string; source: string; title: string; detail?: string; tone: 'neutral' | 'good' | 'warn' | 'bad' }

const TABS = [
  { value: 'overview', label: 'Overview' }, { value: 'activity', label: 'Activity & logs' }, { value: 'billing', label: 'Plan & limits' },
  { value: 'financial', label: 'Financial' }, { value: 'tools', label: 'Tools' }, { value: 'notes', label: 'Notes' },
] as const
type Tab = (typeof TABS)[number]['value']

export default function UserDetail({ id, status }: { id: string; status: AdminStatus }) {
  const { data, error, refresh } = useAdminQuery<Overview>(`/api/admin/users/${id}`)
  const [tab, setTab] = useState<Tab>('overview')
  const perms = new Set(status.permissions ?? [])
  const can = (p: string) => perms.has('*') || perms.has(p)

  if (error && !data) return <><Back /><Notice tone="negative">{error}</Notice></>
  if (!data) return <><Back /><Loading rows={8} /></>

  const banned = !!data.auth.banned_until && new Date(data.auth.banned_until) > new Date()
  const who = personLabel({ name: data.profile?.name, email: data.auth.email, id })
  const tabs = TABS.filter((t) => (t.value === 'activity' ? can('users.logs') : t.value === 'billing' ? can('billing.view') || can('users.limits') : t.value === 'financial' ? can('users.financial') || can('users.pii') : t.value === 'tools' ? can('users.tools') || can('users.suspend') || can('users.reset') || can('users.delete') : true))

  return (
    <>
      <Back />
      <PageHeader
        title={who.primary}
        description={who.secondary ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {banned ? <Pill tone="bad">Suspended</Pill> : null}
            {!data.auth.email_confirmed_at ? <Pill tone="warn">Unverified</Pill> : null}
            {data.staffRole ? <Pill tone="brand">Staff · {data.staffRole}</Pill> : null}
            <Pill tone="neutral">{data.entitlement?.plan_key ?? data.plans.find((p) => p.is_default)?.key ?? 'free'}</Pill>
          </div>
        }
      />
      <div className="mb-5 overflow-x-auto">
        <SegmentedControl ariaLabel="Profile section" options={tabs} value={tab} onChange={setTab} fill={false} />
      </div>

      {tab === 'overview' ? <OverviewTab data={data} /> : null}
      {tab === 'activity' ? <ActivityTab id={id} /> : null}
      {tab === 'billing' ? <BillingTab id={id} data={data} can={can} onChange={refresh} /> : null}
      {tab === 'financial' ? <FinancialTab id={id} /> : null}
      {tab === 'tools' ? <ToolsTab id={id} data={data} banned={banned} can={can} onChange={refresh} /> : null}
      {tab === 'notes' ? <NotesTab id={id} data={data} can={can} onChange={refresh} /> : null}
    </>
  )
}

function Back() {
  return (
    <Button variant="ghost" size="touch" className="-ms-3 mb-2" onClick={() => adminNavigate('users')}>
      <ArrowLeft />All users
    </Button>
  )
}

const COUNT_LABELS: Array<[string, string]> = [
  ['expenses', 'Expenses'], ['income_sources', 'Income sources'], ['budget_plans', 'Budgets'], ['debts', 'Debts'],
  ['subscriptions', 'Subscriptions'], ['goals', 'Goals'], ['savings', 'Savings accounts'], ['receipts', 'Receipts'],
  ['sms_total', 'SMS received'], ['sms_failed', 'SMS failed'], ['notifications_unread', 'Unread notifications'], ['tickets', 'Tickets'],
]

function OverviewTab({ data }: { data: Overview }) {
  const { auth, profile, settings, devices, activity } = data
  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Panel title="Account">
        <dl className="divide-y divide-[var(--color-brand-border)]">
          <KeyValue label="User id" mono>{auth.id}</KeyValue>
          <KeyValue label="Sign-in">{auth.providers.join(', ') || 'email'}</KeyValue>
          <KeyValue label="Email verified">{auth.email_confirmed_at ? dateTime(auth.email_confirmed_at) : 'No'}</KeyValue>
          <KeyValue label="Joined">{dateTime(auth.created_at)}</KeyValue>
          <KeyValue label="Last sign-in">{ago(auth.last_sign_in_at)}</KeyValue>
          <KeyValue label="Last active">{ago(activity.last_event_at)}</KeyValue>
          <KeyValue label="Active days (30d)" mono>{activity.active_days_30d}</KeyValue>
          <KeyValue label="Sessions (30d)" mono>{activity.sessions_30d}</KeyValue>
        </dl>
      </Panel>

      <Panel title="Profile & settings">
        <dl className="divide-y divide-[var(--color-brand-border)]">
          <KeyValue label="Country">{profile?.country ?? '—'}</KeyValue>
          <KeyValue label="Currency">{profile?.base_currency ?? '—'}{profile?.secondary_currency ? ` / ${profile.secondary_currency}` : ''}</KeyValue>
          <KeyValue label="Language">{settings?.language ?? '—'}</KeyValue>
          <KeyValue label="Theme">{settings?.theme ?? '—'}</KeyValue>
          <KeyValue label="AI features">{settings?.enable_ai ? 'On' : 'Off'}</KeyValue>
          <KeyValue label="SMS tracking">{settings?.sms_tracking_enabled ? 'On' : 'Off'}</KeyValue>
          <KeyValue label="Email 2FA">{settings?.two_factor_email_enabled ? 'On' : 'Off'}</KeyValue>
          <KeyValue label="Month starts on day" mono>{settings?.month_start_day ?? '—'}</KeyValue>
        </dl>
      </Panel>

      <Panel title="Devices">
        {devices.push.length === 0 ? <p className="text-sm text-[var(--color-brand-text-muted)]">No push devices registered.</p> : (
          <ul className="divide-y divide-[var(--color-brand-border)]">
            {devices.push.map((d, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5 text-sm">
                <Smartphone className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[var(--color-brand-text-primary)]">{d.device_model ?? d.platform}</p>
                  <p className="truncate text-xs text-[var(--color-brand-text-muted)]">{d.platform} · v{d.app_version ?? '?'} · seen {ago(d.updated_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Pill tone={devices.sms_tokens_active ? 'brand' : 'neutral'}>{devices.sms_tokens_active} SMS token{devices.sms_tokens_active === 1 ? '' : 's'}</Pill>
          <Pill>{devices.trusted} trusted device{devices.trusted === 1 ? '' : 's'}</Pill>
          <Pill>{devices.biometric} biometric</Pill>
        </div>
      </Panel>

      <Panel title="Usage" description="Live records in each area" className="xl:col-span-2">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
          {COUNT_LABELS.map(([k, label]) => (
            <div key={k} className="py-2">
              <dt className="text-[11px] text-[var(--color-brand-text-muted)]">{label}</dt>
              <dd className="font-mono-numbers text-lg font-semibold tabular-nums text-[var(--color-brand-text-primary)]">{num(data.counts[k] ?? 0)}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title="Support history">
        {data.tickets.length === 0 ? <p className="text-sm text-[var(--color-brand-text-muted)]">No tickets from this user.</p> : (
          <ul className="space-y-2">
            {data.tickets.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                <button type="button" data-raw-button-ok="inline ticket link" className="min-w-0 truncate text-start text-[var(--color-brand-primary-ink)] hover:underline" onClick={() => adminNavigate('support', { ticket: t.id })}>#{t.number} {t.subject}</button>
                <StatusPill status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

const TONE_DOT: Record<TimelineEvent['tone'], string> = {
  neutral: 'bg-[var(--color-brand-border-strong)]', good: 'bg-[var(--color-brand-green)]', warn: 'bg-[var(--color-brand-amber)]', bad: 'bg-[var(--color-brand-red)]',
}

function ActivityTab({ id }: { id: string }) {
  const { data, error, loading } = useAdminQuery<{ events: TimelineEvent[] }>(`/api/admin/users/${id}/activity`)
  const [source, setSource] = useState<'all' | 'sms' | 'app' | 'issues'>('all')
  if (error) return <Notice tone="negative">{error}</Notice>
  if (!data) return loading ? <Loading rows={8} /> : null
  const events = data.events.filter((e) => (source === 'all' ? true : source === 'issues' ? e.tone === 'bad' || e.tone === 'warn' : e.source === source))
  return (
    <Panel
      title="Everything we know, newest first"
      description="App opens, SMS imports, notifications, tickets and staff actions"
      actions={<Button variant="outline" size="touch" onClick={() => adminNavigate('sms', { tab: 'tracked', userId: id })}>Open SMS log</Button>}
    >
      <div className="mb-4 overflow-x-auto">
        <SegmentedControl ariaLabel="Filter events" fill={false} value={source} onChange={setSource} options={[{ value: 'all', label: 'All' }, { value: 'issues', label: 'Problems' }, { value: 'sms', label: 'SMS' }, { value: 'app', label: 'App' }]} />
      </div>
      {events.length === 0 ? <p className="py-6 text-center text-sm text-[var(--color-brand-text-muted)]">No events.</p> : (
        <ol className="relative space-y-4 border-s border-[var(--color-brand-border)] ps-5">
          {events.map((e, i) => (
            <li key={i} className="relative">
              <span aria-hidden className={`absolute -start-[25px] top-1.5 size-2.5 rounded-full ring-4 ring-[var(--color-brand-card)] ${TONE_DOT[e.tone]}`} />
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <p className="text-sm text-[var(--color-brand-text-primary)]">{e.title}</p>
                <time className="text-xs text-[var(--color-brand-text-muted)]" title={dateTime(e.at)}>{ago(e.at)}</time>
              </div>
              {e.detail ? <p className="mt-0.5 line-clamp-2 text-xs text-[var(--color-brand-text-muted)]">{e.detail}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

function BillingTab({ id, data, can, onChange }: { id: string; data: Overview; can: (p: string) => boolean; onChange: () => Promise<void> }) {
  const { run, busy } = useAdminAction(`/api/admin/users/${id}`, onChange)
  const ent = data.entitlement
  const defaultPlan = data.plans.find((p) => p.is_default)?.key ?? 'free'
  const [planKey, setPlanKey] = useState(ent?.plan_key ?? defaultPlan)
  const [state, setState] = useState(ent?.status ?? 'active')
  const [trialDays, setTrialDays] = useState('')
  const [note, setNote] = useState(ent?.note ?? '')
  const [limits, setLimits] = useState<Record<string, string>>(() =>
    Object.fromEntries(LIMIT_KEYS.map((k) => [k, ent?.limit_overrides?.[k] === undefined ? '' : ent.limit_overrides[k] === null ? '∞' : String(ent.limit_overrides[k])])),
  )
  const [adjust, setAdjust] = useState(false)
  const manageBilling = can('billing.manage')
  const manageLimits = can('users.limits')

  const saveEntitlement = () =>
    run('ent', { op: 'set_entitlement', planKey, status: state, trialDays: trialDays ? Number(trialDays) : undefined, note }, { success: 'Membership saved' })

  const saveLimits = () => {
    const out: Record<string, number | null> = {}
    for (const [k, v] of Object.entries(limits)) {
      const t = v.trim()
      if (t === '') continue
      out[k] = t === '∞' ? null : Number(t)
    }
    return run('limits', { op: 'set_limits', limits: out, features: ent?.feature_overrides ?? {} }, { success: 'Limits saved' })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Membership" description={ent ? `Source: ${ent.source}${ent.trial_ends_at ? ` · trial ends ${dateTime(ent.trial_ends_at)}` : ''}` : 'No explicit membership — on the default plan'}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Plan">
              <SelectField aria-label="Plan" value={planKey} onChange={setPlanKey} items={data.plans.map((p) => ({ value: p.key, label: p.name }))} className="h-12 w-full" disabled={!manageBilling} />
            </Field>
            <Field label="Status">
              <SelectField aria-label="Status" value={state} onChange={setState} items={['active', 'trialing', 'past_due', 'paused', 'canceled', 'expired'].map((s) => ({ value: s, label: s.replace('_', ' ') }))} className="h-12 w-full" disabled={!manageBilling} />
            </Field>
          </div>
          {state === 'trialing' ? (
            <Field label="Trial length (days)" hint={`Leave empty for the plan default (${data.plans.find((p) => p.key === planKey)?.trial_days ?? 0} days).`}>
              <Input size="brand" type="number" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} disabled={!manageBilling} />
            </Field>
          ) : null}
          <Field label="Internal note"><Input size="brand" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why was this granted?" disabled={!manageBilling} /></Field>
          {manageBilling ? (
            <div className="flex flex-wrap gap-2">
              <Button size="touch" loading={busy === 'ent'} onClick={() => void saveEntitlement()}>Save membership</Button>
              {ent ? <Button variant="outline" size="touch" onClick={() => void run('clear', { op: 'clear_entitlement' }, { success: 'Back on the default plan', confirm: { title: 'Return to the default plan?', body: 'Removes the membership and any individual limit overrides.', destructive: true } })}>Reset to default</Button> : null}
            </div>
          ) : <p className="text-xs text-[var(--color-brand-text-muted)]">Your role can view but not change memberships.</p>}
        </div>
      </Panel>

      <Panel title="Individual limits" description="Overrides beat the plan. Empty = follow the plan · ∞ = unlimited">
        <div className="space-y-3">
          {LIMIT_KEYS.map((k: LimitKey) => {
            const def = LIMIT_CATALOG[k]
            return (
              <div key={k} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm text-[var(--color-brand-text-primary)]">{def.label}{!def.enforced ? <Pill>reserved</Pill> : null}</p>
                  <p className="truncate text-xs text-[var(--color-brand-text-muted)]">{def.unit} · default {def.fallback ?? '∞'}</p>
                </div>
                <Input aria-label={def.label} className="h-10 w-24 text-center font-mono-numbers" placeholder="plan" value={limits[k] ?? ''} onChange={(e) => setLimits({ ...limits, [k]: e.target.value })} disabled={!manageLimits} />
              </div>
            )
          })}
          {manageLimits ? <Button size="touch" loading={busy === 'limits'} onClick={() => void saveLimits()}>Save limits</Button> : null}
          <p className="text-xs text-[var(--color-brand-text-muted)]">“Reserved” limits are stored now and enforced once those features are gated.</p>
        </div>
      </Panel>

      {Object.keys(FEATURE_CATALOG).length > 0 && ent && Object.keys(ent.feature_overrides ?? {}).length > 0 ? (
        <Panel title="Feature overrides">
          <div className="flex flex-wrap gap-2">{Object.entries(ent.feature_overrides).map(([k, v]) => <Pill key={k} tone={v ? 'good' : 'bad'}>{v ? '+' : '−'} {k}</Pill>)}</div>
        </Panel>
      ) : null}

      <Panel
        title="Loyalty"
        description={data.loyalty ? `${num(data.loyalty.points_balance)} points · ${num(data.loyalty.lifetime_points)} lifetime · tier ${data.loyalty.tier_key ?? 'none'}` : 'No loyalty account yet'}
        actions={can('loyalty.manage') ? <Button variant="outline" size="touch" onClick={() => setAdjust(true)}>Adjust points</Button> : undefined}
      >
        {data.loyaltyLedger.length === 0 ? <p className="text-sm text-[var(--color-brand-text-muted)]">No point activity.</p> : (
          <ul className="divide-y divide-[var(--color-brand-border)] text-sm">
            {data.loyaltyLedger.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2"><span className="truncate">{l.reason}</span><span className={`font-mono-numbers tabular-nums ${l.delta > 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]'}`}>{l.delta > 0 ? '+' : ''}{l.delta}</span></li>
            ))}
          </ul>
        )}
      </Panel>
      <AdjustPoints open={adjust} id={id} onClose={() => setAdjust(false)} onDone={onChange} />
    </div>
  )
}

function AdjustPoints({ open, id, onClose, onDone }: { open: boolean; id: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const { run, busy } = useAdminAction('/api/admin/loyalty', onDone)
  return (
    <AdminSheet open={open} title="Adjust loyalty points" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Points (negative to deduct)"><Input size="brand" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} /></Field>
        <Field label="Reason"><Input size="brand" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Goodwill, correction, campaign…" /></Field>
        <Button size="cta-block" loading={busy === 'adj'} disabled={!delta || !reason.trim()} onClick={async () => { if (await run('adj', { op: 'adjust_points', userId: id, delta: Number(delta), reason }, { success: 'Points adjusted' })) { setDelta(''); setReason(''); onClose() } }}>Apply</Button>
      </div>
    </AdminSheet>
  )
}

function ToolsTab({ id, data, banned, can, onChange }: { id: string; data: Overview; banned: boolean; can: (p: string) => boolean; onChange: () => Promise<void> }) {
  const { run, busy } = useAdminAction(`/api/admin/users/${id}`, onChange)
  const stepUp = useStepUp()
  const [notify, setNotify] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const tools = can('users.tools')

  const tool = (key: string, icon: React.ReactNode, label: string, description: string, body: Record<string, unknown>, opts: Parameters<typeof run>[2]) => (
    <li key={key} className="flex items-start gap-3 py-3.5">
      <span className="mt-0.5 text-[var(--color-brand-text-muted)]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-brand-text-primary)]">{label}</p>
        <p className="text-xs text-[var(--color-brand-text-muted)]">{description}</p>
      </div>
      <Button variant="outline" size="touch" loading={busy === key} onClick={() => void run(key, body, opts)}>Run</Button>
    </li>
  )

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {tools ? (
        <Panel title="Fix a tech issue" description="Safe repair tools. Every use is written to the audit log.">
          <ul className="divide-y divide-[var(--color-brand-border)]">
            <li className="flex items-start gap-3 py-3.5">
              <Bell className="mt-0.5 size-[18px] text-[var(--color-brand-text-muted)]" aria-hidden />
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">Send a notification</p><p className="text-xs text-[var(--color-brand-text-muted)]">In-app message plus a push to their devices.</p></div>
              <Button variant="outline" size="touch" onClick={() => setNotify(true)}>Write</Button>
            </li>
            {tool('test_push', <Smartphone className="size-[18px]" />, 'Send a test push', `${data.devices.push.length} device(s) registered. Confirms push delivery end to end.`, { op: 'test_push' }, { success: 'Test push sent' })}
            {tool('reset_sms_tokens', <RotateCcw className="size-[18px]" />, 'Reset SMS pairing', 'Revokes the SMS ingest tokens. The app creates a fresh one on next open — fixes “SMS stopped importing”.', { op: 'reset_sms_tokens' }, { success: 'SMS tokens reset', confirm: { title: 'Reset SMS pairing?', body: 'Their phone will re-pair the next time they open the app.' } })}
            {tool('clear_push_tokens', <Smartphone className="size-[18px]" />, 'Clear push registrations', 'Removes stale device tokens so the app registers cleanly.', { op: 'clear_push_tokens' }, { success: 'Push tokens cleared', confirm: { title: 'Clear push registrations?' } })}
            {tool('clear_trusted_devices', <ShieldAlert className="size-[18px]" />, 'Forget trusted devices', 'They will be asked for an email code on next sign-in.', { op: 'clear_trusted_devices' }, { success: 'Trusted devices cleared', confirm: { title: 'Forget trusted devices?' } })}
            {tool('remove_biometric', <Fingerprint className="size-[18px]" />, 'Remove biometric sign-in', 'Unbinds biometric devices — fixes a stuck Face ID / fingerprint prompt.', { op: 'remove_biometric' }, { success: 'Biometric devices removed', confirm: { title: 'Remove biometric sign-in?' } })}
            {tool('send_password_reset', <Mail className="size-[18px]" />, 'Send password reset email', 'Emails them a secure reset link.', { op: 'send_password_reset' }, { success: 'Reset email sent' })}
          </ul>
        </Panel>
      ) : null}

      <div className="space-y-6">
        {can('users.edit') && !data.auth.email_confirmed_at ? (
          <Panel title="Verification">
            <p className="mb-3 text-sm text-[var(--color-brand-text-secondary)]">Their email isn’t verified. If they can’t receive the email, you can mark it verified.</p>
            <Button variant="outline" size="touch" loading={busy === 'verify'} onClick={() => void run('verify', { op: 'verify_email' }, { success: 'Email verified', confirm: { title: 'Mark email as verified?' } })}><MailCheck />Mark verified</Button>
          </Panel>
        ) : null}

        {can('users.suspend') ? (
          <Panel title="Account access" description={banned ? 'This account is suspended and cannot sign in.' : 'Suspending blocks sign-in and token refresh immediately.'}>
            {banned ? (
              <Button size="touch" loading={busy === 'restore'} onClick={() => void run('restore', { op: 'restore' }, { success: 'Account restored' })}>Restore account</Button>
            ) : (
              <Button variant="destructive" size="touch" loading={busy === 'suspend'} onClick={() => void run('suspend', { op: 'suspend' }, { success: 'Account suspended', confirm: { title: 'Suspend this account?', body: 'They will be signed out and blocked until you restore them.', destructive: true, confirmLabel: 'Suspend' } })}>Suspend account</Button>
            )}
          </Panel>
        ) : null}

        {can('users.reset') ? (
          <Panel title="Reset account" description="Erases all of their data and starts them fresh. They stay signed up with their plan and sign-in; every device clears its copy on its next sync.">
            <Button variant="destructive" size="touch" loading={busy === 'reset'} onClick={async () => {
              const proof = await stepUp('Resetting an account erases all of its data. Confirm it’s you.')
              if (!proof) return
              void run('reset', { op: 'reset_data', ...proof }, { success: 'Account reset', confirm: { title: 'Reset this account?', body: `All of ${data.auth.email ?? id}’s data is erased and cannot be recovered. They keep their sign-in.`, destructive: true, confirmLabel: 'Erase and reset' } })
            }}><RotateCcw />Reset account</Button>
          </Panel>
        ) : null}

        {can('users.delete') ? (
          <Panel title="Danger zone" description="Permanent. Deletes the account and all of their data.">
            <Button variant="destructive-solid" size="touch" loading={busy === 'delete'} onClick={async () => {
              const proof = await stepUp('Deleting a user is permanent. Confirm it’s you.')
              if (!proof) return
              if (await run('delete', { op: 'delete', ...proof }, { success: 'User deleted', confirm: { title: 'Delete this user forever?', body: `${data.auth.email ?? id} and all their data will be erased.`, destructive: true, confirmLabel: 'Delete forever' } })) adminNavigate('users')
            }}><Trash2 />Delete user</Button>
          </Panel>
        ) : null}
        {!tools && !can('users.suspend') && !can('users.reset') && !can('users.delete') ? <Notice>Your role has no repair tools.</Notice> : null}
      </div>

      <AdminSheet open={notify} title="Send a notification" onClose={() => setNotify(false)}>
        <div className="space-y-4">
          <Field label="Title"><Input size="brand" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Message"><Textarea value={body} maxLength={400} rows={4} onChange={(e) => setBody(e.target.value)} /></Field>
          <Button size="cta-block" loading={busy === 'notify'} disabled={!title.trim() || !body.trim()} onClick={async () => { if (await run('notify', { op: 'notify', title, body }, { success: 'Notification sent' })) { setTitle(''); setBody(''); setNotify(false) } }}>Send</Button>
        </div>
      </AdminSheet>
    </div>
  )
}

function NotesTab({ id, data, can, onChange }: { id: string; data: Overview; can: (p: string) => boolean; onChange: () => Promise<void> }) {
  const [text, setText] = useState('')
  const { run, busy } = useAdminAction(`/api/admin/users/${id}`, onChange)
  return (
    <Panel title="Internal notes" description="Only staff can see these. Use them to hand a case over.">
      {can('users.edit') ? (
        <div className="mb-5 space-y-3">
          <Textarea aria-label="New note" rows={3} placeholder="What should the next person know?" value={text} onChange={(e) => setText(e.target.value)} />
          <Button size="touch" loading={busy === 'note'} disabled={!text.trim()} onClick={async () => { if (await run('note', { op: 'note', body: text }, { success: 'Note added' })) setText('') }}>Add note</Button>
        </div>
      ) : null}
      {data.notes.length === 0 ? <p className="text-sm text-[var(--color-brand-text-muted)]">No notes yet.</p> : (
        <ul className="space-y-3">
          {data.notes.map((n) => (
            <li key={n.id} className="rounded-xl bg-[var(--color-brand-elevated)] p-3.5">
              <p className="whitespace-pre-wrap text-sm text-[var(--color-brand-text-primary)]">{n.body}</p>
              <p className="mt-2 text-xs text-[var(--color-brand-text-muted)]">{n.author_label ?? 'Staff'} · {ago(n.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
