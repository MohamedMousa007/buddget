'use client'

import { useMemo, useState } from 'react'
import { Crown, Lock, Plus, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OptionChip } from '@/components/ui/OptionChip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SelectField } from '@/components/ui/SelectField'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useActionToast } from '@/components/ui/ActionToast'
import { useAdminQuery } from '../adminClient'
import { ago } from '../format'
import { useAdminAction } from '../useAdminAction'
import { AdminSheet } from '../ui/AdminSheet'
import { DataTable, type Column } from '../ui/DataTable'
import { Field } from '../ui/Field'
import { Loading, Notice, PageHeader, Panel } from '../ui/Panel'
import { Pill, StatusPill } from '../ui/Pill'
import { useStepUp } from '../ui/StepUp'
import type { AdminStatus } from '../types'

interface Member {
  id: string; email: string; user_id: string | null; display_name: string | null; department: string | null; role_key: string
  extra_permissions: string[]; status: 'active' | 'suspended'; created_at: string; last_login_at: string | null
  secured: boolean; liveSessions: number; isOwner: boolean
}
interface Role { key: string; name: string; description: string; rank: number; permissions: string[]; is_system: boolean }
interface StaffData { staff: Member[]; roles: Role[]; permissions: Record<string, string>; ownerOnly: string[]; actorRank: number; ownerEmail: string }

const groupOf = (perm: string) => perm.split('.')[0]!

export default function StaffView({ status }: { status: AdminStatus }) {
  const { data, error, refresh } = useAdminQuery<StaffData>('/api/admin/staff')
  const [tab, setTab] = useState<'team' | 'roles'>('team')
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [roleDraft, setRoleDraft] = useState<Role | null>(null)
  const canManage = (status.permissions ?? []).some((p) => p === '*' || p === 'staff.manage')

  const roleName = useMemo(() => new Map(data?.roles.map((r) => [r.key, r.name])), [data])

  if (error && !data) return <Notice tone="negative">{error}</Notice>
  if (!data) return <Loading rows={6} />

  const columns: Column<Member>[] = [
    { key: 'who', header: 'Teammate', cell: (m) => (
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-brand-primary-soft)] text-sm font-semibold text-[var(--color-brand-primary-ink)]">{(m.display_name?.trim() || m.email).slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0"><p className="truncate font-medium text-[var(--color-brand-text-primary)]">{m.display_name?.trim() || m.email}{m.isOwner ? <Crown className="ms-1.5 inline size-3.5 text-[var(--color-brand-gold)]" aria-label="Owner" /> : null}</p>{m.display_name?.trim() ? <p className="truncate text-xs text-[var(--color-brand-text-muted)]">{m.email}</p> : null}</div>
      </div>
    ) },
    { key: 'role', header: 'Role', cell: (m) => <span className="flex items-center gap-1.5">{roleName.get(m.role_key) ?? m.role_key}{m.extra_permissions.length ? <Pill tone="brand">+{m.extra_permissions.length}</Pill> : null}</span> },
    { key: 'dept', header: 'Department', wide: true, cell: (m) => <span className="text-[var(--color-brand-text-secondary)]">{m.department ?? '—'}</span> },
    { key: 'sec', header: 'Security', cell: (m) => m.secured ? <Pill tone="good"><ShieldCheck className="size-3" aria-hidden />2FA on</Pill> : <Pill tone="warn">{m.user_id ? 'Setup pending' : 'No account yet'}</Pill> },
    { key: 'status', header: 'Status', cell: (m) => <StatusPill status={m.status} /> },
    { key: 'login', header: 'Last sign-in', wide: true, cell: (m) => <span className="text-[var(--color-brand-text-secondary)]">{ago(m.last_login_at)}</span> },
  ]

  return (
    <>
      <PageHeader title="Team & roles" description="Who can see and do what. Every change here is audited." actions={canManage ? <Button size="touch" onClick={() => setInviting(true)}><Plus />Add teammate</Button> : undefined} />
      <div className="mb-5"><SegmentedControl ariaLabel="Team section" fill={false} value={tab} onChange={setTab} options={[{ value: 'team', label: 'Team', count: data.staff.length }, { value: 'roles', label: 'Roles & permissions', count: data.roles.length }]} /></div>

      {tab === 'team' ? (
        <Panel flush>
          <DataTable rows={data.staff} columns={columns} rowKey={(m) => m.id} onRowClick={(m) => setEditing(m)} />
        </Panel>
      ) : (
        <RolesTab data={data} canManage={canManage} onEdit={setRoleDraft} onCreate={() => setRoleDraft({ key: '', name: '', description: '', rank: data.actorRank + 40, permissions: [], is_system: false })} />
      )}

      {inviting ? <InviteSheet data={data} onClose={() => setInviting(false)} onDone={refresh} /> : null}
      {editing ? <MemberSheet key={editing.id} member={editing} data={data} canManage={canManage} onClose={() => setEditing(null)} onDone={refresh} /> : null}
      {roleDraft ? <RoleSheet key={roleDraft.key || 'new'} role={roleDraft} data={data} onClose={() => setRoleDraft(null)} onDone={refresh} /> : null}
    </>
  )
}

function RolesTab({ data, canManage, onEdit, onCreate }: { data: StaffData; canManage: boolean; onEdit: (r: Role) => void; onCreate: () => void }) {
  const groups = [...new Set(Object.keys(data.permissions).map(groupOf))]
  return (
    <div className="space-y-6">
      <Panel title="Permission matrix" description="Lower rank = more power. You can only manage roles ranked below your own." actions={canManage ? <Button variant="outline" size="touch" onClick={onCreate}><Plus />Custom role</Button> : undefined} flush>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-[var(--color-brand-border)]">
                <th className="px-4 py-2.5 text-start text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand-text-muted)]">Permission</th>
                {data.roles.map((r) => (
                  <th key={r.key} className="px-2 py-2.5 text-center">
                    {canManage && !r.is_system && r.rank > data.actorRank ? <button type="button" data-raw-button-ok="role header opens the editor" onClick={() => onEdit(r)} className="font-semibold text-[var(--color-brand-primary-ink)] hover:underline">{r.name}</button> : <span className="font-semibold text-[var(--color-brand-text-primary)]">{r.name}</span>}
                    <span className="block font-normal text-[var(--color-brand-text-muted)]">rank {r.rank}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g} group={g} data={data} />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

function GroupRows({ group, data }: { group: string; data: StaffData }) {
  const perms = Object.keys(data.permissions).filter((p) => groupOf(p) === group)
  return (
    <>
      <tr><td colSpan={data.roles.length + 1} className="bg-[var(--color-brand-elevated)]/60 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-brand-text-muted)]">{group}</td></tr>
      {perms.map((p) => (
        <tr key={p} className="border-b border-[var(--color-brand-border)]">
          <td className="px-4 py-2"><span className="font-mono text-[var(--color-brand-text-primary)]">{p}</span><span className="block text-[var(--color-brand-text-muted)]">{data.permissions[p]}</span></td>
          {data.roles.map((r) => {
            const has = r.permissions.includes('*') ? !data.ownerOnly.includes(p) || r.key === 'owner' : r.permissions.includes(p)
            return <td key={r.key} className="px-2 py-2 text-center">{has ? <span className="text-[var(--color-brand-green)]" aria-label="Allowed">●</span> : <span className="text-[var(--color-brand-border-strong)]" aria-label="Not allowed">○</span>}</td>
          })}
        </tr>
      ))}
    </>
  )
}

function PermissionPicker({ data, value, onChange, inherited = [] }: { data: StaffData; value: string[]; onChange: (v: string[]) => void; inherited?: string[] }) {
  const offered = Object.keys(data.permissions).filter((p) => !data.ownerOnly.includes(p))
  return (
    <div className="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-[var(--color-brand-border)] p-3">
      {[...new Set(offered.map(groupOf))].map((g) => (
        <div key={g}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-brand-text-muted)]">{g}</p>
          <div className="flex flex-wrap gap-1.5">
            {offered.filter((p) => groupOf(p) === g).map((p) => (
              <OptionChip key={p} size="sm" title={data.permissions[p]} selected={value.includes(p) || inherited.includes(p)} disabled={inherited.includes(p)} onClick={() => onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p])}>{p.split('.')[1]}</OptionChip>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const assignable = (d: StaffData) => d.roles.filter((r) => r.key !== 'owner' && r.rank > d.actorRank).map((r) => ({ value: r.key, label: r.name, description: r.description }))

function InviteSheet({ data, onClose, onDone }: { data: StaffData; onClose: () => void; onDone: () => Promise<void> }) {
  const { run, busy } = useAdminAction('/api/admin/staff', onDone)
  const roles = assignable(data)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [department, setDepartment] = useState('')
  const [roleKey, setRoleKey] = useState(roles[0]?.value ?? '')
  const [sendEmail, setSendEmail] = useState(true)
  const toast = useActionToast()
  return (
    <AdminSheet open title="Add a teammate" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-brand-text-secondary)]">We email them a link that signs them in and opens the portal, where they set their admin password and confirm it with an emailed code. They can also sign in to Buddget with this email and use the admin icon beside their profile.</p>
        <Field label="Email"><Input size="brand" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input size="brand" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Department"><Input size="brand" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Support, Finance…" /></Field>
        </div>
        <Field label="Role"><SelectField aria-label="Role" value={roleKey} onChange={setRoleKey} items={roles} className="h-12 w-full" /></Field>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-brand-border)] px-4 py-3">
          <span className="text-sm text-[var(--color-brand-text)]">Email them an invite link</span>
          <Switch size="touch" checked={sendEmail} onCheckedChange={setSendEmail} aria-label="Email them an invite link" />
        </div>
        <Button size="cta-block" loading={busy === 'invite'} disabled={!email.trim() || !roleKey} onClick={async () => {
          let emailed = true
          const ok = await run('invite', { op: 'invite', email, displayName: name, department, roleKey, sendEmail }, { success: sendEmail ? 'Teammate added, invite sent' : 'Teammate added', then: (res: { emailSent?: boolean }) => { emailed = res.emailSent !== false } })
          if (!ok) return
          if (sendEmail && !emailed) toast('Added, but the invite email could not be sent. Open them and press Resend invite.')
          onClose()
        }}>Add teammate</Button>
      </div>
    </AdminSheet>
  )
}

function MemberSheet({ member, data, canManage, onClose, onDone }: { member: Member; data: StaffData; canManage: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const { run, busy } = useAdminAction('/api/admin/staff', async () => { await onDone(); onClose() })
  const stepUp = useStepUp()
  const [name, setName] = useState(member.display_name ?? '')
  const [department, setDepartment] = useState(member.department ?? '')
  const [roleKey, setRoleKey] = useState(member.role_key)
  const [extra, setExtra] = useState(member.extra_permissions)
  const roles = assignable(data)
  const currentRole = data.roles.find((r) => r.key === roleKey)
  const editable = canManage && !member.isOwner && (data.roles.find((r) => r.key === member.role_key)?.rank ?? 0) > data.actorRank

  const guarded = async (key: string, body: Record<string, unknown>, why: string, opts: Parameters<typeof run>[2]) => {
    const proof = await stepUp(why)
    if (proof) await run(key, { ...body, id: member.id, ...proof }, opts)
  }

  return (
    <AdminSheet open title={member.display_name?.trim() || member.email} onClose={onClose} wide>
      <div className="space-y-4">
        {member.isOwner ? <Notice tone="info"><span className="flex items-center gap-2"><Lock className="size-4" aria-hidden />The owner account is permanent. Its role and access can’t be changed from the portal, by anyone.</span></Notice> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input size="brand" value={name} disabled={!editable} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Department"><Input size="brand" value={department} disabled={!editable} onChange={(e) => setDepartment(e.target.value)} /></Field>
        </div>
        {!member.isOwner ? <Field label="Role"><SelectField aria-label="Role" value={roleKey} onChange={setRoleKey} items={roles.some((r) => r.value === roleKey) ? roles : [...roles, { value: roleKey, label: data.roles.find((r) => r.key === roleKey)?.name ?? roleKey, description: '' }]} className="h-12 w-full" disabled={!editable} /></Field> : null}
        {!member.isOwner ? <div><p className="mb-2 text-xs font-medium text-[var(--color-brand-text-secondary)]">Extra permissions on top of the role</p><PermissionPicker data={data} value={extra} onChange={setExtra} inherited={currentRole?.permissions ?? []} /></div> : null}
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-brand-text-muted)]">
          <Pill tone={member.secured ? 'good' : 'warn'}>{member.secured ? 'Set up' : 'Not secured yet'}</Pill>
          <span>{member.liveSessions} active session{member.liveSessions === 1 ? '' : 's'} · last sign-in {ago(member.last_login_at)}</span>
        </div>
        {editable ? (
          <div className="space-y-3 border-t border-[var(--color-brand-border)] pt-4">
            <Button size="cta-block" loading={busy === 'save'} onClick={() => void guarded('save', { op: 'update', displayName: name, department, roleKey, extraPermissions: extra }, 'Changing a role or permissions signs that person out of the portal. Confirm it’s you.', { success: 'Saved' })}>Save changes</Button>
            <div className="flex flex-wrap gap-2">
              {member.status === 'active'
                ? <Button variant="outline" size="touch" loading={busy === 'suspend'} onClick={() => void run('suspend', { op: 'suspend', id: member.id }, { success: 'Suspended', confirm: { title: `Suspend ${member.display_name?.trim() || member.email}?`, body: 'They lose portal access immediately.', destructive: true } })}>Suspend</Button>
                : <Button variant="outline" size="touch" loading={busy === 'restore'} onClick={() => void run('restore', { op: 'restore', id: member.id }, { success: 'Restored' })}>Restore</Button>}
              {!member.secured && member.status === 'active' ? <Button variant="outline" size="touch" loading={busy === 'resend'} onClick={() => void run('resend', { op: 'resend_invite', id: member.id }, { success: 'Invite sent' })}>Resend invite</Button> : null}
              {member.user_id ? <Button variant="outline" size="touch" onClick={() => void guarded('reset', { op: 'reset_credentials' }, 'This signs them out and forces them to set up their admin password again.', { success: 'Security reset' })}>Reset their security</Button> : null}
              <Button variant="destructive" size="touch" onClick={() => void guarded('remove', { op: 'remove' }, 'Removing a teammate revokes all their access.', { success: 'Removed', confirm: { title: 'Remove from the team?', destructive: true } })}>Remove</Button>
            </div>
          </div>
        ) : null}
      </div>
    </AdminSheet>
  )
}

function RoleSheet({ role, data, onClose, onDone }: { role: Role; data: StaffData; onClose: () => void; onDone: () => Promise<void> }) {
  const { run, busy } = useAdminAction('/api/admin/staff', async () => { await onDone(); onClose() })
  const stepUp = useStepUp()
  const isNew = !role.key
  const [r, setR] = useState(role)
  return (
    <AdminSheet open title={isNew ? 'Custom role' : `Edit ${role.name}`} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Key"><Input size="brand" value={r.key} disabled={!isNew} onChange={(e) => setR({ ...r, key: e.target.value.toLowerCase() })} className="font-mono" /></Field>
          <Field label="Name"><Input size="brand" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
        </div>
        <Field label="Description"><Textarea rows={2} value={r.description} onChange={(e) => setR({ ...r, description: e.target.value })} /></Field>
        <Field label="Rank" hint={`Must be above ${data.actorRank}. Higher numbers have less authority.`}><Input size="brand" type="number" value={r.rank} onChange={(e) => setR({ ...r, rank: Number(e.target.value) })} /></Field>
        <PermissionPicker data={data} value={r.permissions} onChange={(permissions) => setR({ ...r, permissions })} />
        <Button size="cta-block" loading={busy === 'role'} disabled={!r.key || !r.name.trim()} onClick={async () => {
          const code = await stepUp('Creating or changing a role changes what staff can do. Confirm it’s you.')
          if (code) await run('role', { op: 'upsert_role', code, role: { key: r.key, name: r.name, description: r.description, permissions: r.permissions, rank: r.rank } }, { success: 'Role saved' })
        }}>Save role</Button>
        {!isNew ? <Button variant="destructive" size="touch" onClick={() => void run('delrole', { op: 'delete_role', key: r.key }, { success: 'Role deleted', confirm: { title: `Delete ${r.name}?`, destructive: true } })}>Delete role</Button> : null}
      </div>
    </AdminSheet>
  )
}
