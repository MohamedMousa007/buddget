'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectField } from '@/components/ui/SelectField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { formatFounderNumber } from '@/lib/loyalty/loyaltyApi'
import { useAdminQuery } from '../adminClient'
import { ago, dateTime, num } from '../format'
import { useAdminAction } from '../useAdminAction'
import { AdminSheet } from '../ui/AdminSheet'
import { Field } from '../ui/Field'
import { KeyValue, Loading, Notice, Panel } from '../ui/Panel'
import { Pill, StatusPill } from '../ui/Pill'

interface Referral { id: number; invitee_id: string | null; inviter_id?: string | null; status: string; reason: string | null; active_days: number; tx_count: number; reward_kind: string | null; created_at: string; activated_at: string | null; rewarded_at: string | null }
interface RewardsData {
  entitlement: { plan_key: string; status: string; source: string; store: string | null; trial_ends_at: string | null; current_period_end: string | null; will_renew: boolean | null; note: string | null; updated_at: string } | null
  bankedProDays: number
  loyalty: { points_balance: number; lifetime_points: number; tier_key: string | null; tier_locked: boolean; streak_weeks: number; streak_best: number; freezes_banked: number; last_kept_week: string | null; multiplier_step: number } | null
  founder: { number: number; cohort: string; granted_at: string; retired_at: string | null; credit_name_status: string } | null
  tiers: Array<{ key: string; name: string; min_points: number; requires_pro: boolean; requires_founder: boolean; sparks_gift: number }>
  sparks: {
    available: number; buckets: Record<string, number>
    allowances: Array<{ id: string; kind: string; granted: number; used: number; period_start: string; period_end: string; reason: string | null }>
    purchases: Array<{ id: string; store: string; product_id: string; sparks: number; bonus_sparks: number; remaining: number; purchased_at: string; refunded_at: string | null }>
    spend: Array<{ feature: string; sparks: number; created_at: string }>
  } | null
  referrals: { code: { code: string; invited_count: number; activated_count: number; rewards_count: number } | null; invites: Referral[]; invitedBy: Referral | null } | null
}

type SheetKind = 'grant_pro' | 'remove_pro' | 'start_trial' | 'bank_days' | 'adjust_sparks' | 'adjust_points' | 'set_tier' | 'set_streak' | 'set_founder'

const SHEET_DEFAULTS: Record<SheetKind, Record<string, string>> = {
  grant_pro: { until: 'removed', date: '', note: '' }, remove_pro: { note: '' }, start_trial: { days: '30' }, bank_days: { days: '7' },
  adjust_sparks: { amount: '', bucket: 'reward', reason: '' }, adjust_points: { delta: '', reason: '' }, set_tier: { tier: '', lock: 'lock' },
  set_streak: { weeks: '' }, set_founder: { number: '' },
}

/** "Membership and rewards" on a user's profile: plan, trial, banked Pro, Sparks, tier, points, streak, founder and invites, each action behind its permission. */
export default function RewardsTab({ id, can, onChange }: { id: string; can: (p: string) => boolean; onChange: () => Promise<void> }) {
  const { data, error, refresh } = useAdminQuery<RewardsData>(`/api/admin/users/${id}/rewards`)
  const done = async () => { await Promise.all([refresh(), onChange()]) }
  const { run, busy } = useAdminAction(`/api/admin/users/${id}/rewards`, done)
  const points = useAdminAction('/api/admin/loyalty', done)
  const [sheet, setSheet] = useState<SheetKind | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})

  if (error && !data) return <Notice tone="negative">{error}</Notice>
  if (!data) return <Loading rows={6} />

  const open = (kind: SheetKind) => { setForm(SHEET_DEFAULTS[kind]); setSheet(kind) }
  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }))
  const close = () => setSheet(null)
  const act = (key: string, body: Record<string, unknown>, success: string, confirm: { title: string; body?: string; destructive?: boolean; confirmLabel?: string }) =>
    run(key, body, { success, confirm }).then((ok) => { if (ok) close() })

  const grantPro = can('billing.grant')
  const ent = data.entitlement
  const l = data.loyalty
  const tierName = (key: string | null) => (key ? data.tiers.find((t) => t.key === key)?.name ?? key : 'None')
  const isPro = ent?.plan_key === 'plus' || ent?.plan_key === 'plus_trial'

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Panel title="Plan" description="Pro granted here is a promo: with an end date or until removed. Every change is written to the audit log.">
        <dl className="divide-y divide-[var(--color-brand-border)]">
          <KeyValue label="Plan">{ent?.plan_key ?? 'free'}{isPro ? <span className="ms-2"><Pill tone="brand">Pro</Pill></span> : null}</KeyValue>
          <KeyValue label="Status"><StatusPill status={ent?.status ?? 'active'} /></KeyValue>
          <KeyValue label="Source">{ent ? `${ent.source}${ent.store ? ` · ${ent.store}` : ''}` : 'default'}</KeyValue>
          <KeyValue label="Trial ends">{ent?.trial_ends_at ? dateTime(ent.trial_ends_at) : '—'}</KeyValue>
          <KeyValue label="Pro ends">{ent?.current_period_end ? dateTime(ent.current_period_end) : isPro && ent?.plan_key === 'plus' ? 'Until removed' : '—'}</KeyValue>
          <KeyValue label="Banked Pro days" mono>{num(data.bankedProDays)}</KeyValue>
          {ent?.note ? <KeyValue label="Note">{ent.note}</KeyValue> : null}
        </dl>
        {grantPro ? (
          <Actions>
            <Button size="touch" onClick={() => open('grant_pro')}>Make Pro</Button>
            <Button variant="outline" size="touch" disabled={!ent || ent.plan_key === 'free'} onClick={() => open('remove_pro')}>Make Free</Button>
            <Button variant="outline" size="touch" onClick={() => open('start_trial')}>Start trial</Button>
            <Button variant="outline" size="touch" loading={busy === 'end_trial'} disabled={ent?.status !== 'trialing'} onClick={() => void run('end_trial', { op: 'end_trial' }, { success: 'Trial ended', confirm: { title: 'End this trial now?', body: 'They go back to Free. Any banked Pro days start now.', destructive: true, confirmLabel: 'End trial' } })}>End trial</Button>
            <Button variant="outline" size="touch" onClick={() => open('bank_days')}>Bank Pro days</Button>
            <Button variant="outline" size="touch" loading={busy === 'unbank_days'} disabled={data.bankedProDays === 0} onClick={() => void run('unbank_days', { op: 'unbank_days' }, { success: 'Banked days removed', confirm: { title: `Remove ${data.bankedProDays} banked Pro days?`, body: 'Days that have not started yet are cancelled. Days already running are not touched.', destructive: true, confirmLabel: 'Remove' } })}>Remove banked days</Button>
          </Actions>
        ) : <ReadOnly />}
      </Panel>

      <Panel title="Loyalty" description={l ? `Tier ${tierName(l.tier_key)}${l.tier_locked ? ' (locked)' : ''}` : 'No loyalty account yet. Any action below creates one.'}>
        <dl className="divide-y divide-[var(--color-brand-border)]">
          <KeyValue label="Tier">{tierName(l?.tier_key ?? null)}{l?.tier_locked ? <span className="ms-2"><Pill tone="warn">Locked</Pill></span> : null}</KeyValue>
          <KeyValue label="Points, lifetime" mono>{num(l?.lifetime_points ?? 0)}</KeyValue>
          <KeyValue label="Points, spendable" mono>{num(l?.points_balance ?? 0)}</KeyValue>
          <KeyValue label="Streak" mono>{num(l?.streak_weeks ?? 0)} weeks · best {num(l?.streak_best ?? 0)}</KeyValue>
          <KeyValue label="Last kept week">{l?.last_kept_week ?? '—'}</KeyValue>
          <KeyValue label="Freezes" mono>{l?.freezes_banked ?? 0} of 2</KeyValue>
          <KeyValue label="Founder">{data.founder ? `${formatFounderNumber(data.founder.number)} · ${data.founder.cohort}${data.founder.retired_at ? ' · removed' : ''}` : 'No'}</KeyValue>
        </dl>
        {can('loyalty.manage') ? (
          <Actions>
            <Button size="touch" onClick={() => open('adjust_points')}>Adjust points</Button>
            <Button variant="outline" size="touch" onClick={() => { open('set_tier'); setForm({ tier: l?.tier_key ?? '', lock: 'lock' }) }}>Set tier</Button>
            <Button variant="outline" size="touch" onClick={() => open('set_streak')}>Set streak</Button>
            <Button variant="outline" size="touch" loading={busy === 'freeze_add'} disabled={(l?.freezes_banked ?? 0) >= 2} onClick={() => void run('freeze_add', { op: 'add_freezes', count: 1 }, { success: 'Freeze added', confirm: { title: 'Add one streak freeze?', body: 'They can hold at most 2.' } })}>Add freeze</Button>
            <Button variant="outline" size="touch" loading={busy === 'freeze_remove'} disabled={!l?.freezes_banked} onClick={() => void run('freeze_remove', { op: 'add_freezes', count: -1 }, { success: 'Freeze removed', confirm: { title: 'Remove one streak freeze?' } })}>Remove freeze</Button>
            <Button variant="outline" size="touch" onClick={() => open('set_founder')}>{data.founder && !data.founder.retired_at ? 'Change founder number' : 'Make founder'}</Button>
            {data.founder && !data.founder.retired_at ? <Button variant="outline" size="touch" loading={busy === 'remove_founder'} onClick={() => void run('remove_founder', { op: 'remove_founder' }, { success: 'Founder removed', confirm: { title: `Remove founder ${formatFounderNumber(data.founder!.number)}?`, body: 'The number is retired and never given to anyone else.', destructive: true, confirmLabel: 'Remove founder' } })}>Remove founder</Button> : null}
            <Button variant="destructive" size="touch" loading={busy === 'reset_loyalty'} onClick={() => void run('reset_loyalty', { op: 'reset_loyalty' }, { success: 'Loyalty reset', confirm: { title: 'Reset this user’s loyalty?', body: 'Points, streak, freezes, tier lock, owned items and the points history are cleared. Founder status stays.', destructive: true, confirmLabel: 'Reset loyalty' } })}>Reset loyalty</Button>
          </Actions>
        ) : <ReadOnly />}
      </Panel>

      {data.sparks ? (
        <Panel title="Sparks" description={`${num(data.sparks.available)} available now`} actions={<Button variant="outline" size="touch" onClick={() => open('adjust_sparks')}>Add or remove Sparks</Button>}>
          <div className="mb-4 flex flex-wrap gap-2">
            {Object.keys(data.sparks.buckets).length === 0 ? <Pill>No open Sparks</Pill> : Object.entries(data.sparks.buckets).map(([k, n]) => <Pill key={k} tone={k === 'purchased' ? 'brand' : 'neutral'}>{k}: {num(n)}</Pill>)}
          </div>
          <SparksLedgerList sparks={data.sparks} />
        </Panel>
      ) : null}

      {data.referrals ? <InvitesPanel data={data.referrals} busy={busy} run={run} /> : null}

      <AdminSheet open={sheet !== null} title={sheet ? SHEET_TITLES[sheet] : ''} onClose={close}>
        <div className="space-y-4">
          {sheet === 'grant_pro' ? (
            <>
              <SegmentedControl ariaLabel="How long" value={form.until as 'removed' | 'date'} onChange={set('until')} options={[{ value: 'removed', label: 'Until removed' }, { value: 'date', label: 'Until a date' }]} />
              {form.until === 'date' ? <Field label="Pro ends on"><Input size="brand" type="date" value={form.date} onChange={(e) => set('date')(e.target.value)} /></Field> : null}
              <Field label="Reason (saved as the plan note)"><Input size="brand" value={form.note} maxLength={300} onChange={(e) => set('note')(e.target.value)} placeholder="Tester, goodwill, campaign…" /></Field>
              <Button size="cta-block" loading={busy === 'grant_pro'} disabled={form.until === 'date' && !form.date} onClick={() => {
                const endsAt = form.until === 'date' ? new Date(`${form.date}T23:59:59`).toISOString() : null
                void act('grant_pro', { op: 'grant_pro', endsAt, note: form.note }, 'Pro granted', { title: endsAt ? `Make Pro until ${form.date}?` : 'Make Pro until removed?', body: 'Replaces their current plan or trial.' })
              }}>Make Pro</Button>
            </>
          ) : null}
          {sheet === 'remove_pro' ? (
            <>
              <p className="text-sm text-[var(--color-brand-text-secondary)]">They go back to Free now. A store subscription comes back with its next store event.</p>
              <Field label="Reason (saved as the plan note)"><Input size="brand" value={form.note} maxLength={300} onChange={(e) => set('note')(e.target.value)} /></Field>
              <Button variant="destructive" size="cta-block" loading={busy === 'remove_pro'} onClick={() => void act('remove_pro', { op: 'remove_pro', note: form.note }, 'Back on Free', { title: 'Make this user Free?', destructive: true, confirmLabel: 'Make Free' })}>Make Free</Button>
            </>
          ) : null}
          {sheet === 'start_trial' ? (
            <NumberForm label="Trial length (days, 1 to 90)" value={form.days} onChange={set('days')} busy={busy === 'start_trial'} submit="Start trial"
              onSubmit={() => void act('start_trial', { op: 'start_trial', days: Number(form.days) }, 'Trial started', { title: `Start a ${form.days}-day Pro trial?`, body: 'Replaces their current plan.' })} />
          ) : null}
          {sheet === 'bank_days' ? (
            <NumberForm label="Pro days to bank (1 to 366)" hint="They start when their current Pro or trial ends, or now if they are on Free." value={form.days} onChange={set('days')} busy={busy === 'bank_days'} submit="Bank days"
              onSubmit={() => void act('bank_days', { op: 'bank_days', days: Number(form.days) }, 'Pro days banked', { title: `Bank ${form.days} Pro days?` })} />
          ) : null}
          {sheet === 'adjust_sparks' ? (
            <>
              <Field label="Sparks (negative to remove)" hint="Removing takes reward Sparks first, then purchased."><Input size="brand" type="number" value={form.amount} onChange={(e) => set('amount')(e.target.value)} /></Field>
              <Field label="Bucket when adding"><SegmentedControl ariaLabel="Bucket" value={form.bucket as 'reward' | 'purchased'} onChange={set('bucket')} options={[{ value: 'reward', label: 'Reward (12 months)' }, { value: 'purchased', label: 'Purchased (test)' }]} /></Field>
              <Field label="Reason (required)"><Input size="brand" value={form.reason} maxLength={300} onChange={(e) => set('reason')(e.target.value)} /></Field>
              <Button size="cta-block" loading={busy === 'adjust_sparks'} disabled={!Number(form.amount) || !form.reason.trim()} onClick={() => {
                const amount = Number(form.amount)
                void act('adjust_sparks', { op: 'adjust_sparks', amount, bucket: form.bucket, reason: form.reason }, amount > 0 ? 'Sparks added' : 'Sparks removed', { title: amount > 0 ? `Add ${num(amount)} Sparks?` : `Remove ${num(-amount)} Sparks?`, destructive: amount < 0 })
              }}>Apply</Button>
            </>
          ) : null}
          {sheet === 'adjust_points' ? (
            <>
              <Field label="Points (negative to deduct)" hint="Adding raises lifetime and spendable points; the tier follows."><Input size="brand" type="number" value={form.delta} onChange={(e) => set('delta')(e.target.value)} /></Field>
              <Field label="Reason (required)"><Input size="brand" value={form.reason} maxLength={200} onChange={(e) => set('reason')(e.target.value)} /></Field>
              <Button size="cta-block" loading={points.busy === 'adj'} disabled={!Number(form.delta) || !form.reason.trim()} onClick={() => void points.run('adj', { op: 'adjust_points', userId: id, delta: Number(form.delta), reason: form.reason }, { success: 'Points adjusted', confirm: { title: `Change points by ${form.delta}?` } }).then((ok) => { if (ok) close() })}>Apply</Button>
            </>
          ) : null}
          {sheet === 'set_tier' ? (
            <>
              <SegmentedControl ariaLabel="Lock" value={form.lock as 'lock' | 'unlock'} onChange={set('lock')} options={[{ value: 'lock', label: 'Pin a tier' }, { value: 'unlock', label: 'Unlock (follow points)' }]} />
              {form.lock === 'lock' ? <Field label="Tier"><SelectField aria-label="Tier" value={form.tier} onChange={set('tier')} items={[{ value: '', label: 'No tier' }, ...data.tiers.map((t) => ({ value: t.key, label: `${t.name} · ${num(t.min_points)}+` }))]} className="h-12 w-full" /></Field> : <p className="text-sm text-[var(--color-brand-text-secondary)]">The tier is recomputed from their lifetime points, Pro and founder status.</p>}
              <Button size="cta-block" loading={busy === 'set_tier'} onClick={() => void act('set_tier', { op: 'set_tier', tier: form.lock === 'lock' ? form.tier || null : null, locked: form.lock === 'lock' }, 'Tier saved', { title: form.lock === 'lock' ? `Pin tier ${tierName(form.tier || null)}?` : 'Unlock the tier?' })}>Save tier</Button>
            </>
          ) : null}
          {sheet === 'set_streak' ? (
            <NumberForm label="Streak (weeks, 0 to 520)" hint="Counts as kept through last week; the multiplier follows the weeks." value={form.weeks} onChange={set('weeks')} busy={busy === 'set_streak'} submit="Set streak"
              onSubmit={() => void act('set_streak', { op: 'set_streak', weeks: Number(form.weeks) }, 'Streak set', { title: `Set the streak to ${form.weeks} weeks?` })} />
          ) : null}
          {sheet === 'set_founder' ? (
            <NumberForm label="Founder number" hint="Leave empty for the next free number." optional value={form.number} onChange={set('number')} busy={busy === 'set_founder'} submit="Save founder"
              onSubmit={() => void act('set_founder', { op: 'set_founder', number: form.number ? Number(form.number) : null }, 'Founder saved', { title: form.number ? `Make founder ${formatFounderNumber(Number(form.number))}?` : 'Make founder with the next number?' })} />
          ) : null}
        </div>
      </AdminSheet>
    </div>
  )
}

const SHEET_TITLES: Record<SheetKind, string> = {
  grant_pro: 'Make Pro', remove_pro: 'Make Free', start_trial: 'Start a trial', bank_days: 'Bank Pro days', adjust_sparks: 'Add or remove Sparks',
  adjust_points: 'Adjust points', set_tier: 'Set tier', set_streak: 'Set streak', set_founder: 'Founder',
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex flex-wrap gap-2">{children}</div>
}

function ReadOnly() {
  return <p className="mt-4 text-xs text-[var(--color-brand-text-muted)]">Your role can view but not change this.</p>
}

function NumberForm({ label, hint, value, onChange, busy, submit, onSubmit, optional = false }: { label: string; hint?: string; value: string; onChange: (v: string) => void; busy: boolean; submit: string; onSubmit: () => void; optional?: boolean }) {
  const valid = optional ? value === '' || Number.isInteger(Number(value)) : value !== '' && Number.isInteger(Number(value))
  return (
    <>
      <Field label={label} hint={hint}><Input size="brand" type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} /></Field>
      <Button size="cta-block" loading={busy} disabled={!valid} onClick={onSubmit}>{submit}</Button>
    </>
  )
}

function SparksLedgerList({ sparks }: { sparks: NonNullable<RewardsData['sparks']> }) {
  const rows = [
    ...sparks.allowances.map((a) => ({ at: a.period_start, delta: a.granted, label: `${a.kind}${a.reason ? ` · ${a.reason}` : ''}`, sub: `${num(a.used)} used · ends ${dateTime(a.period_end)}` })),
    ...sparks.purchases.map((p) => ({ at: p.purchased_at, delta: p.sparks + p.bonus_sparks, label: `${p.store} · ${p.product_id}`, sub: `${num(p.remaining)} left${p.refunded_at ? ' · refunded' : ''}` })),
    ...sparks.spend.map((s) => ({ at: s.created_at, delta: -s.sparks, label: s.feature, sub: '' })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15)
  if (rows.length === 0) return <p className="text-sm text-[var(--color-brand-text-muted)]">No Sparks activity.</p>
  return (
    <ul className="divide-y divide-[var(--color-brand-border)] text-sm">
      {rows.map((r, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-2">
          <div className="min-w-0"><p className="truncate">{r.label}</p><p className="text-xs text-[var(--color-brand-text-muted)]">{ago(r.at)}{r.sub ? ` · ${r.sub}` : ''}</p></div>
          <span className={`font-mono-numbers tabular-nums ${r.delta > 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]'}`}>{r.delta > 0 ? '+' : ''}{num(r.delta)}</span>
        </li>
      ))}
    </ul>
  )
}

type Run = ReturnType<typeof useAdminAction>['run']

function InvitesPanel({ data, busy, run }: { data: NonNullable<RewardsData['referrals']>; busy: string | null; run: Run }) {
  const c = data.code
  const row = (r: Referral, who: string) => {
    const k = (op: string) => `${op}:${r.id}`
    return (
      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">{who}<StatusPill status={r.status} />{r.reward_kind ? <Pill tone="good">{r.reward_kind}</Pill> : null}</p>
          <p className="text-xs text-[var(--color-brand-text-muted)]">Joined {ago(r.created_at)} · {r.active_days}/3 active days · {r.tx_count}/5 records{r.reason ? ` · ${r.reason}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {r.status === 'pending' || r.status === 'expired' ? <Button variant="outline" size="touch" loading={busy === k('mark')} onClick={() => void run(k('mark'), { op: 'mark_referral_activated', referralId: r.id }, { success: 'Marked activated', confirm: { title: 'Mark this friend activated?', body: 'Runs the normal reward path: device guards and caps apply.' } })}>Mark activated</Button> : null}
          {r.status !== 'rewarded' && r.status !== 'revoked' ? <Button variant="outline" size="touch" loading={busy === k('approve')} onClick={() => void run(k('approve'), { op: 'approve_referral', referralId: r.id }, { success: 'Reward approved', confirm: { title: 'Approve this invite reward?', body: 'Pays the reward even past caps or device guards.' } })}>Approve</Button> : null}
          {r.status !== 'revoked' ? <Button variant="destructive" size="touch" loading={busy === k('revoke')} onClick={() => void run(k('revoke'), { op: 'revoke_referral', referralId: r.id }, { success: 'Invite revoked', confirm: { title: 'Revoke this invite?', body: 'Any reward it paid is clawed back.', destructive: true, confirmLabel: 'Revoke' } })}>Revoke</Button> : null}
        </div>
      </li>
    )
  }
  return (
    <Panel title="Invites" description={c ? `Code ${c.code} · ${num(c.invited_count)} invited · ${num(c.activated_count)} activated · ${num(c.rewards_count)} rewarded` : 'No invite code yet'} className="xl:col-span-2">
      {data.invitedBy ? <ul className="mb-2 border-b border-[var(--color-brand-border)]">{row(data.invitedBy, 'Invited by another user')}</ul> : null}
      {data.invites.length === 0 ? <p className="py-2 text-sm text-[var(--color-brand-text-muted)]">Has not invited anyone.</p> : (
        <ul className="divide-y divide-[var(--color-brand-border)]">{data.invites.map((r, i) => row(r, `Friend ${data.invites.length - i}`))}</ul>
      )}
    </Panel>
  )
}
