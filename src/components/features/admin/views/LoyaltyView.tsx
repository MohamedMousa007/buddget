'use client'

import { useState } from 'react'
import { Award, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Textarea } from '@/components/ui/textarea'
import { useAdminQuery } from '../adminClient'
import { ago, num } from '../format'
import { useAdminAction } from '../useAdminAction'
import { AdminSheet } from '../ui/AdminSheet'
import { BarList, CHART } from '../ui/Charts'
import { Field } from '../ui/Field'
import { KpiGrid, StatTile } from '../ui/Kpi'
import { Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import { Pill, StatusPill } from '../ui/Pill'
import type { AdminStatus } from '../types'

interface Tier { key: string; name: string; description: string; min_points: number; color: string | null; perks: string[]; status: 'draft' | 'active' | 'archived'; sort_order: number }
interface LoyaltyData { tiers: Tier[]; byTier: Record<string, number>; members: number; outstandingPoints: number; ledger: Array<{ id: number; user_id: string; delta: number; reason: string; created_at: string }>; programLive: boolean }

const BLANK: Tier = { key: '', name: '', description: '', min_points: 0, color: null, perks: [], status: 'draft', sort_order: 0 }

export default function LoyaltyView({ status }: { status: AdminStatus }) {
  const { data, error, refresh } = useAdminQuery<LoyaltyData>('/api/admin/loyalty')
  const { run, busy } = useAdminAction('/api/admin/loyalty', refresh)
  const [editing, setEditing] = useState<{ tier: Tier; isNew: boolean; perks: string } | null>(null)
  const canManage = (status.permissions ?? []).some((p) => p === '*' || p === 'loyalty.manage')

  if (error && !data) return <Notice tone="negative">{error}</Notice>
  if (!data) return <Loading rows={6} />

  return (
    <>
      <PageHeader title="Loyalty" description="Tiers, points and perks. Design the ladder here; points are granted from user profiles until earning rules ship." actions={canManage ? <Button size="touch" onClick={() => setEditing({ tier: BLANK, isNew: true, perks: '' })}><Plus />New tier</Button> : undefined} />
      <div className="space-y-6">
        {!data.programLive ? <Notice tone="info">The loyalty program is not live in the app yet. Tiers and balances are stored and manageable now, so launch is a switch rather than a migration.</Notice> : null}
        <KpiGrid cols={3}>
          <StatTile label="Tiers" value={data.tiers.filter((t) => t.status === 'active').length} sub={`${data.tiers.length} defined`} icon={<Award className="size-4" />} />
          <StatTile label="Members" value={num(data.members)} sub="with a loyalty account" />
          <StatTile label="Outstanding points" value={num(data.outstandingPoints)} sub="liability across all balances" />
        </KpiGrid>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="Tier ladder" className="xl:col-span-2" flush>
            {data.tiers.length === 0 ? <p className="px-5 py-12 text-center text-sm text-[var(--color-brand-text-muted)]">No tiers yet. Create your first, for example Bronze at 0 points.</p> : (
              <ol className="divide-y divide-[var(--color-brand-border)]">
                {data.tiers.map((t) => (
                  <li key={t.key} className="flex items-start gap-4 px-5 py-4">
                    <span className="mt-1 grid size-9 shrink-0 place-items-center rounded-full" style={{ background: t.color ?? 'var(--color-brand-primary-soft)' }}><Award className="size-4 text-[var(--color-brand-text-primary)]" aria-hidden /></span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">{t.name}<StatusPill status={t.status} /><Pill>{num(t.min_points)}+ pts</Pill><Pill tone="brand">{num(data.byTier[t.key] ?? 0)} members</Pill></p>
                      {t.description ? <p className="mt-0.5 text-xs text-[var(--color-brand-text-muted)]">{t.description}</p> : null}
                      {t.perks.length ? <ul className="mt-2 flex flex-wrap gap-1.5">{t.perks.map((p) => <Pill key={p}>{p}</Pill>)}</ul> : null}
                    </div>
                    {canManage ? (
                      <div className="flex gap-1">
                        <Button variant="outline" size="touch" onClick={() => setEditing({ tier: t, isNew: false, perks: t.perks.join('\n') })}>Edit</Button>
                        <IconButton aria-label={`Delete ${t.name}`} variant="danger" size="md" onClick={() => void run('del', { op: 'delete_tier', key: t.key }, { success: 'Tier deleted', confirm: { title: `Delete ${t.name}?`, destructive: true } })}><Trash2 /></IconButton>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          <Panel title="Members by tier">
            <BarList color={CHART.two} items={[...data.tiers.map((t) => ({ label: t.name, value: data.byTier[t.key] ?? 0 })), ...(data.byTier.none ? [{ label: 'No tier', value: data.byTier.none }] : [])]} empty="No members yet." />
          </Panel>
        </div>

        <Panel title="Recent point activity" flush>
          {data.ledger.length === 0 ? <p className="px-5 py-8 text-center text-sm text-[var(--color-brand-text-muted)]">No point movements yet.</p> : (
            <ul className="divide-y divide-[var(--color-brand-border)] text-sm">
              {data.ledger.map((l) => <li key={l.id} className="flex items-center justify-between px-5 py-3"><span className="truncate">{l.reason}</span><span className="flex items-center gap-3"><span className="text-xs text-[var(--color-brand-text-muted)]">{ago(l.created_at)}</span><span className={`font-mono-numbers tabular-nums ${l.delta > 0 ? 'text-[var(--color-brand-green)]' : 'text-[var(--color-brand-red)]'}`}>{l.delta > 0 ? '+' : ''}{l.delta}</span></span></li>)}
            </ul>
          )}
        </Panel>
      </div>

      {editing ? (
        <AdminSheet open title={editing.isNew ? 'New tier' : `Edit ${editing.tier.name}`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Key"><Input size="brand" value={editing.tier.key} disabled={!editing.isNew} onChange={(e) => setEditing({ ...editing, tier: { ...editing.tier, key: e.target.value.toLowerCase() } })} className="font-mono" /></Field>
              <Field label="Name"><Input size="brand" value={editing.tier.name} onChange={(e) => setEditing({ ...editing, tier: { ...editing.tier, name: e.target.value } })} /></Field>
            </div>
            <Field label="Lifetime points to reach this tier"><Input size="brand" type="number" value={editing.tier.min_points} onChange={(e) => setEditing({ ...editing, tier: { ...editing.tier, min_points: Number(e.target.value) } })} /></Field>
            <Field label="Description"><Input size="brand" value={editing.tier.description} onChange={(e) => setEditing({ ...editing, tier: { ...editing.tier, description: e.target.value } })} /></Field>
            <Field label="Perks" hint="One per line"><Textarea rows={4} value={editing.perks} onChange={(e) => setEditing({ ...editing, perks: e.target.value })} /></Field>
            <SegmentedControl ariaLabel="Tier status" fill={false} value={editing.tier.status} onChange={(v) => setEditing({ ...editing, tier: { ...editing.tier, status: v } })} options={[{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]} />
            <Button size="cta-block" loading={busy === 'save'} disabled={!editing.tier.key || !editing.tier.name.trim()} onClick={async () => {
              const t = editing.tier
              if (await run('save', { op: 'upsert_tier', tier: { key: t.key, name: t.name, description: t.description, minPoints: t.min_points, color: t.color, perks: editing.perks.split('\n').map((s) => s.trim()).filter(Boolean), status: t.status, sortOrder: t.sort_order } }, { success: 'Tier saved' })) setEditing(null)
            }}>Save tier</Button>
          </div>
        </AdminSheet>
      ) : null}
    </>
  )
}
