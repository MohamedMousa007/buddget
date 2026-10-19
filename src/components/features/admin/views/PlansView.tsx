'use client'

import { useState } from 'react'
import { Check, Clock, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Textarea } from '@/components/ui/textarea'
import { adminNavigate } from '../adminRouter'
import { useAdminQuery } from '../adminClient'
import { dateTime, money, num } from '../format'
import { useAdminAction } from '../useAdminAction'
import { AdminSheet } from '../ui/AdminSheet'
import { Field } from '../ui/Field'
import { KpiGrid, StatTile } from '../ui/Kpi'
import { Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import { Pill, StatusPill } from '../ui/Pill'
import type { AdminStatus } from '../types'

interface Plan {
  key: string; name: string; description: string; status: 'draft' | 'active' | 'archived'; is_default: boolean
  price_monthly_cents: number | null; price_yearly_cents: number | null; currency: string; trial_days: number
  limits: Record<string, number | null>; features: string[]; sort_order: number
}
interface Catalog { limits: Record<string, { label: string; unit: string; fallback: number | null; enforced: boolean }>; features: Record<string, string> }
interface PlansData { plans: Plan[]; members: Record<string, Record<string, number>>; trials: Array<{ user_id: string; plan_key: string; trial_ends_at: string }>; catalog: Catalog; billingLive: boolean }

const BLANK: Plan = { key: '', name: '', description: '', status: 'draft', is_default: false, price_monthly_cents: null, price_yearly_cents: null, currency: 'USD', trial_days: 0, limits: {}, features: [], sort_order: 10 }

export default function PlansView({ status }: { status: AdminStatus }) {
  const { data, error, refresh } = useAdminQuery<PlansData>('/api/admin/plans')
  const { run, busy } = useAdminAction('/api/admin/plans', refresh)
  const [editing, setEditing] = useState<{ plan: Plan; isNew: boolean } | null>(null)
  const canManage = (status.permissions ?? []).some((p) => p === '*' || p === 'billing.manage')

  if (error && !data) return <Notice tone="negative">{error}</Notice>
  if (!data) return <Loading rows={6} />

  const totalMembers = (key: string) => Object.values(data.members[key] ?? {}).reduce((a, b) => a + b, 0)
  const trialing = Object.values(data.members).reduce((n, m) => n + (m.trialing ?? 0), 0)
  const paid = data.plans.filter((p) => !p.is_default).reduce((n, p) => n + (data.members[p.key]?.active ?? 0), 0)

  return (
    <>
      <PageHeader title="Plans & memberships" description="The freemium model, trials and per-plan limits. Define plans here, grant them to users from their profile." actions={canManage ? <Button size="touch" onClick={() => setEditing({ plan: BLANK, isNew: true })}><Plus />New plan</Button> : undefined} />
      <div className="space-y-6">
        {!data.billingLive ? <Notice tone="info">Billing is not connected yet. Plans, trials and limits are fully functional and enforced where noted; paid checkout (App Store, Google Play or Stripe) attaches to <code>user_entitlements</code> when you build it.</Notice> : null}
        <KpiGrid>
          <StatTile label="Plans" value={data.plans.filter((p) => p.status === 'active').length} sub={`${data.plans.length} total`} />
          <StatTile label="Paying members" value={num(paid)} sub="on a non-default plan" />
          <StatTile label="On trial" value={num(trialing)} />
          <StatTile label="Default plan" value={data.plans.find((p) => p.is_default)?.name ?? '—'} sub="what new users get" />
        </KpiGrid>

        <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
          {data.plans.map((p) => (
            <Panel
              key={p.key}
              title={<span className="flex items-center gap-2">{p.name}{p.is_default ? <Pill tone="brand">Default</Pill> : null}<StatusPill status={p.status} /></span>}
              description={p.description || p.key}
              actions={canManage ? <Button variant="outline" size="touch" onClick={() => setEditing({ plan: p, isNew: false })}>Edit</Button> : undefined}
            >
              <div className="space-y-4">
                <div className="flex items-baseline gap-4">
                  <p className="font-mono-numbers text-2xl font-bold">{p.price_monthly_cents ? money(p.price_monthly_cents, p.currency) : 'Free'}{p.price_monthly_cents ? <span className="text-sm font-normal text-[var(--color-brand-text-muted)]"> /mo</span> : null}</p>
                  {p.price_yearly_cents ? <p className="text-sm text-[var(--color-brand-text-secondary)]">{money(p.price_yearly_cents, p.currency)} /yr</p> : null}
                </div>
                {p.trial_days > 0 ? <p className="flex items-center gap-1.5 text-xs text-[var(--color-brand-text-secondary)]"><Clock className="size-3.5" aria-hidden />{p.trial_days}-day free trial</p> : null}
                <ul className="space-y-1.5 text-sm">
                  {Object.entries(data.catalog.limits).map(([k, def]) => {
                    const v = k in p.limits ? p.limits[k] : def.fallback
                    return <li key={k} className="flex justify-between"><span className="text-[var(--color-brand-text-secondary)]">{def.label}</span><span className="font-mono-numbers">{v === null ? '∞' : `${v} ${def.unit}`}</span></li>
                  })}
                </ul>
                <div className="flex flex-wrap gap-1.5">{p.features.map((f) => <Pill key={f} tone="good"><Check className="size-3" aria-hidden />{data.catalog.features[f] ?? f}</Pill>)}</div>
                <div className="flex items-center justify-between border-t border-[var(--color-brand-border)] pt-3 text-xs text-[var(--color-brand-text-muted)]">
                  <span>{num(totalMembers(p.key))} member{totalMembers(p.key) === 1 ? '' : 's'}{data.members[p.key]?.trialing ? ` · ${data.members[p.key]!.trialing} trialing` : ''}</span>
                  {canManage && !p.is_default && p.status === 'active' ? <Button variant="ghost" size="sm" onClick={() => void run('default', { op: 'set_default', key: p.key }, { success: `${p.name} is now the default`, confirm: { title: `Make ${p.name} the default plan?`, body: 'New users, and anyone whose membership lapses, land on this plan.' } })}>Make default</Button> : null}
                </div>
              </div>
            </Panel>
          ))}
        </div>

        {data.trials.length > 0 ? (
          <Panel title="Trials ending soon">
            <ul className="divide-y divide-[var(--color-brand-border)] text-sm">
              {data.trials.map((t) => (
                <li key={t.user_id} className="flex items-center justify-between py-2.5">
                  <button type="button" data-raw-button-ok="inline user link" className="text-[var(--color-brand-primary-ink)] hover:underline" onClick={() => adminNavigate('users', { id: t.user_id })}>{t.user_id.slice(0, 8)}… · {t.plan_key}</button>
                  <span className="text-[var(--color-brand-text-muted)]">ends {dateTime(t.trial_ends_at)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>

      {editing ? <PlanEditor key={editing.plan.key || 'new'} initial={editing.plan} isNew={editing.isNew} catalog={data.catalog} busy={busy === 'save'} canDelete={canManage && !editing.isNew && !editing.plan.is_default}
        onClose={() => setEditing(null)}
        onDelete={() => run('del', { op: 'delete', key: editing.plan.key }, { success: 'Plan deleted', confirm: { title: `Delete ${editing.plan.name}?`, destructive: true } }).then((ok) => ok && setEditing(null))}
        onSave={(p) => run('save', { op: 'upsert', plan: { key: p.key, name: p.name, description: p.description, status: p.status, priceMonthlyCents: p.price_monthly_cents, priceYearlyCents: p.price_yearly_cents, currency: p.currency, trialDays: p.trial_days, limits: p.limits, features: p.features, sortOrder: p.sort_order } }, { success: 'Plan saved' }).then((ok) => ok && setEditing(null))} /> : null}
    </>
  )
}

function PlanEditor({ initial, isNew, catalog, busy, canDelete, onClose, onSave, onDelete }: { initial: Plan; isNew: boolean; catalog: Catalog; busy: boolean; canDelete: boolean; onClose: () => void; onSave: (p: Plan) => void; onDelete: () => void }) {
  const [p, setP] = useState<Plan>(initial)
  const set = <K extends keyof Plan>(k: K, v: Plan[K]) => setP((prev) => ({ ...prev, [k]: v }))
  const cents = (v: string) => (v === '' ? null : Math.round(Number(v) * 100))
  const setLimit = (k: string, v: string) => setP((prev) => {
    const limits = { ...prev.limits }
    if (v === '') delete limits[k]; else limits[k] = v === '∞' ? null : Number(v)
    return { ...prev, limits }
  })
  return (
    <AdminSheet open title={isNew ? 'New plan' : `Edit ${initial.name}`} onClose={onClose} wide>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pe-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Key" hint="Permanent id used in code, e.g. plus"><Input size="brand" value={p.key} disabled={!isNew} onChange={(e) => set('key', e.target.value.toLowerCase())} className="font-mono" /></Field>
          <Field label="Name"><Input size="brand" value={p.name} onChange={(e) => set('name', e.target.value)} /></Field>
        </div>
        <Field label="Description"><Textarea rows={2} value={p.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Monthly price"><Input size="brand" type="number" value={p.price_monthly_cents == null ? '' : p.price_monthly_cents / 100} onChange={(e) => set('price_monthly_cents', cents(e.target.value))} /></Field>
          <Field label="Yearly price"><Input size="brand" type="number" value={p.price_yearly_cents == null ? '' : p.price_yearly_cents / 100} onChange={(e) => set('price_yearly_cents', cents(e.target.value))} /></Field>
          <Field label="Free trial (days)"><Input size="brand" type="number" value={p.trial_days} onChange={(e) => set('trial_days', Number(e.target.value))} /></Field>
        </div>
        <div><p className="mb-2 text-xs font-medium text-[var(--color-brand-text-secondary)]">Status</p>
          <SegmentedControl ariaLabel="Plan status" fill={false} value={p.status} onChange={(v) => set('status', v)} options={[{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]} /></div>
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-brand-text-secondary)]">Limits <span className="text-[var(--color-brand-text-muted)]">· empty = platform default, ∞ = unlimited</span></p>
          <div className="space-y-2">
            {Object.entries(catalog.limits).map(([k, def]) => (
              <div key={k} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 text-sm">{def.label} <span className="text-xs text-[var(--color-brand-text-muted)]">{def.unit}{!def.enforced ? ' · reserved' : ''}</span></span>
                <Input aria-label={def.label} className="h-10 w-24 text-center font-mono-numbers" placeholder={String(def.fallback ?? '∞')} value={k in p.limits ? (p.limits[k] === null ? '∞' : String(p.limits[k])) : ''} onChange={(e) => setLimit(k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>
        <div><p className="mb-2 text-xs font-medium text-[var(--color-brand-text-secondary)]">Included features</p>
          <div className="flex flex-wrap gap-2">{Object.entries(catalog.features).map(([k, label]) => <OptionChip key={k} selected={p.features.includes(k)} onClick={() => set('features', p.features.includes(k) ? p.features.filter((f) => f !== k) : [...p.features, k])}>{label}</OptionChip>)}</div></div>
        <div className="flex gap-2">
          <Button size="cta" className="flex-1" loading={busy} disabled={!p.key || !p.name.trim()} onClick={() => onSave(p)}>Save plan</Button>
          {canDelete ? <Button variant="destructive" size="cta" onClick={onDelete}>Delete</Button> : null}
        </div>
      </div>
    </AdminSheet>
  )
}
