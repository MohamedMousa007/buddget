'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SelectField } from '@/components/ui/SelectField'
import { adminNavigate, useAdminRoute } from '../adminRouter'
import { useAdminQuery } from '../adminClient'
import { ago, num, personLabel, shortDate } from '../format'
import { DataTable, type Column } from '../ui/DataTable'
import { Toolbar } from '../ui/Field'
import { Notice, PageHeader, Panel } from '../ui/Panel'
import { Pill, StatusPill } from '../ui/Pill'
import type { AdminStatus } from '../types'
import UserDetail from './UserDetail'

interface UserRow {
  id: string
  email: string | null
  name: string | null
  created_at: string
  last_sign_in_at: string | null
  banned_until: string | null
  confirmed: boolean
  provider: string
  country: string | null
  currency: string | null
  plan_key: string
  plan_status: string
  last_active_at: string | null
  expenses: number
  sms_enabled: boolean
  platforms: string | null
}

const PAGE = 25
const STATES = [
  { value: 'all', label: 'All' }, { value: 'inactive', label: 'Inactive 30d+' }, { value: 'sms', label: 'SMS on' },
  { value: 'unconfirmed', label: 'Unverified' }, { value: 'banned', label: 'Suspended' },
] as const
const ORDERS = [
  { value: 'created_desc', label: 'Newest first' }, { value: 'created_asc', label: 'Oldest first' },
  { value: 'active_desc', label: 'Recently active' }, { value: 'expenses_desc', label: 'Most expenses' }, { value: 'email_asc', label: 'Email A–Z' },
]

const isBanned = (u: UserRow) => !!u.banned_until && new Date(u.banned_until) > new Date()

export default function UsersView({ status }: { status: AdminStatus }) {
  const route = useAdminRoute()
  if (route.params.id) return <UserDetail id={route.params.id} status={status} />
  return <UserList initialQuery={route.params.q ?? ''} initialState={route.params.state ?? 'all'} />
}

function UserList({ initialQuery, initialState }: { initialQuery: string; initialState: string }) {
  const [q, setQ] = useState(initialQuery)
  const [applied, setApplied] = useState(initialQuery)
  const [state, setState] = useState<(typeof STATES)[number]['value']>((STATES.find((s) => s.value === initialState)?.value ?? 'all'))
  const [order, setOrder] = useState('created_desc')
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- header search deep-links into this list
    setQ(initialQuery); setApplied(initialQuery); setOffset(0)
  }, [initialQuery])

  const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset), order })
  if (applied) params.set('q', applied)
  if (state !== 'all') params.set('state', state)
  const { data, error, loading } = useAdminQuery<{ total: number; rows: UserRow[] }>(`/api/admin/users?${params}`)

  const open = (u: UserRow) => adminNavigate('users', { id: u.id })

  const columns: Column<UserRow>[] = [
    {
      key: 'user', header: 'User',
      cell: (u) => {
        const who = personLabel(u)
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-brand-primary-soft)] text-sm font-semibold text-[var(--color-brand-primary-ink)]">{who.initial}</span>
            <div className="min-w-0">
              <p className="truncate font-medium text-[var(--color-brand-text-primary)]">{who.primary}</p>
              {who.secondary ? <p className="truncate text-xs text-[var(--color-brand-text-muted)]">{who.secondary}</p> : null}
            </div>
          </div>
        )
      },
    },
    { key: 'status', header: 'Status', cell: (u) => (isBanned(u) ? <Pill tone="bad">Suspended</Pill> : !u.confirmed ? <Pill tone="warn">Unverified</Pill> : <Pill tone="good">Good</Pill>) },
    { key: 'plan', header: 'Plan', cell: (u) => <span className="flex items-center gap-1.5">{u.plan_key}{u.plan_status !== 'active' ? <StatusPill status={u.plan_status} /> : null}</span> },
    { key: 'active', header: 'Last active', cell: (u) => <span className="text-[var(--color-brand-text-secondary)]">{ago(u.last_active_at)}</span> },
    { key: 'expenses', header: 'Expenses', numeric: true, cell: (u) => num(u.expenses), wide: true },
    { key: 'sms', header: 'SMS', cell: (u) => (u.sms_enabled ? <Pill tone="brand">On</Pill> : <span className="text-[var(--color-brand-text-muted)]">Off</span>), wide: true },
    { key: 'platform', header: 'Platform', cell: (u) => <span className="text-[var(--color-brand-text-secondary)]">{u.platforms?.split(',').map((p) => (p === 'ios' ? 'iOS' : p === 'android' ? 'Android' : p)).join(', ') || 'Web'}</span>, wide: true },
    { key: 'joined', header: 'Joined', cell: (u) => <span className="text-[var(--color-brand-text-secondary)]">{shortDate(u.created_at)}</span> },
  ]

  const total = data?.total ?? 0
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + PAGE, total)

  return (
    <>
      <PageHeader title="Users" description="Everyone who has an account. Open a profile to see their logs, fix issues and change limits." />
      <Panel flush>
        <Toolbar>
          <form className="relative min-w-[220px] flex-1" onSubmit={(e) => { e.preventDefault(); setApplied(q.trim()); setOffset(0) }}>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-brand-text-muted)]" aria-hidden />
            <Input aria-label="Search users" placeholder="Search email, name or user id" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 ps-9" />
          </form>
          <SelectField aria-label="Sort" value={order} onChange={(v) => { setOrder(v); setOffset(0) }} items={ORDERS} className="h-10 w-44" />
        </Toolbar>
        <div className="overflow-x-auto border-b border-[var(--color-brand-border)] px-5 py-3">
          <SegmentedControl ariaLabel="Filter users" options={STATES} value={state} onChange={(v) => { setState(v); setOffset(0) }} fill={false} />
        </div>
        {error ? <div className="p-5"><Notice tone="negative">{error}</Notice></div> : null}
        <DataTable rows={data?.rows ?? []} columns={columns} rowKey={(u) => u.id} onRowClick={open} loading={loading} />
        <div className="flex items-center justify-between gap-3 border-t border-[var(--color-brand-border)] px-5 py-3 text-xs text-[var(--color-brand-text-muted)]">
          <span>{total === 0 ? 'No users' : `${from}–${to} of ${num(total)}`}</span>
          <span className="flex gap-1">
            <Button variant="outline" size="touch" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} aria-label="Previous page"><ChevronLeft /></Button>
            <Button variant="outline" size="touch" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)} aria-label="Next page"><ChevronRight /></Button>
          </span>
        </div>
      </Panel>
    </>
  )
}
