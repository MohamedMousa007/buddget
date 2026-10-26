'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CornerDownLeft, LifeBuoy, Search, User, X } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/input'
import { Scrim } from '@/components/ui/Scrim'
import { useDismissable } from '@/hooks/useDismissable'
import { useScrollLock } from '@/lib/ui/scrollLock'
import { can, type PermissionSet } from '@/lib/admin/permissions'
import { searchAdmin } from '@/lib/admin/search'
import { cn } from '@/lib/utils'
import { adminNavigate } from './adminRouter'
import { LIVE_MIN_CHARS, useAdminLiveSearch } from './useAdminLiveSearch'

interface Row {
  key: string
  group: string
  title: string
  sub?: string
  icon?: 'user' | 'ticket'
  go: () => void
}

const OPEN_GRACE_MS = 400

export function AdminSearchButton({ perms }: { perms: PermissionSet }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <IconButton aria-label="Search the admin portal" title="Search" variant="tinted" size="sm" onClick={() => setOpen(true)}><Search /></IconButton>
      {open ? <SearchOverlay perms={perms} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

function SearchOverlay({ perms, onClose }: { perms: PermissionSet; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const openedAt = useRef(0)
  const listId = useId()

  useScrollLock(true)
  useDismissable(true, onClose)
  useEffect(() => {
    openedAt.current = performance.now()
    inputRef.current?.focus()
  }, [])

  const canUsers = can(perms, 'users.view')
  const canTickets = can(perms, 'support.view')
  const live = useAdminLiveSearch(query, canUsers, canTickets)

  const rows = useMemo<Row[]>(() => {
    const go = (section: string, params: Record<string, string>) => () => { onClose(); adminNavigate(section, params) }
    const out: Row[] = searchAdmin(query, perms).flatMap((g) =>
      g.entries.map((e): Row => ({ key: e.id, group: g.group, title: e.title, sub: e.description, go: go(e.section, e.params) })),
    )
    live.users.forEach((u) => out.push({ key: `u:${u.id}`, group: 'Matching users', title: u.primary, sub: u.secondary ?? undefined, icon: 'user', go: go('users', { id: u.id }) }))
    live.tickets.forEach((t) => out.push({ key: `t:${t.id}`, group: 'Matching tickets', title: `#${t.number} ${t.subject}`, sub: t.requester ?? undefined, icon: 'ticket', go: go('support', { ticket: t.id }) }))
    return out
  }, [query, perms, live.users, live.tickets, onClose])

  const active = Math.min(cursor, Math.max(rows.length - 1, 0))
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, rows.length])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (rows.length) setCursor((active + (e.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      rows[active]?.go()
    }
  }

  const liveHint = live.active && live.loading ? 'Searching users and tickets…' : null
  const liveEmpty = live.active && !live.loading && !live.failed && live.users.length + live.tickets.length === 0 && (canUsers || canTickets)
  const noResults = query.trim() !== '' && rows.length === 0 && !live.loading

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Search the admin portal">
      <Scrim label="Close search" onClick={() => { if (performance.now() - openedAt.current > OPEN_GRACE_MS) onClose() }} />
      <div className="pointer-events-none relative flex h-full justify-center px-3 pb-[env(safe-area-inset-bottom,0px)] pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] md:pt-[12vh]">
        <div className="pointer-events-auto flex max-h-full min-h-0 w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] shadow-[var(--shadow-lg)] md:max-h-[70dvh]">
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-brand-border)] px-3 py-2">
            <Search className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden />
            <Input
              ref={inputRef}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
              aria-label="Search pages, settings, users and tickets"
              placeholder="Search pages, users, tickets…"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setCursor(0) }}
              onKeyDown={onKeyDown}
              className="h-11 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
            />
            <IconButton aria-label="Close search" onClick={onClose}><X /></IconButton>
          </div>
          <ul id={listId} ref={listRef} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
            {rows.map((r, i) => (
              <li key={r.key} role="presentation">
                {i === 0 || rows[i - 1].group !== r.group ? (
                  <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-text-muted)]">{r.group}</p>
                ) : null}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  tabIndex={-1}
                  onClick={r.go}
                  onMouseMove={() => setCursor(i)}
                  className={cn('mx-1 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2', i === active && 'bg-[var(--color-brand-primary-soft)]')}
                >
                  {r.icon === 'user' ? <User className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden /> : r.icon === 'ticket' ? <LifeBuoy className="size-4 shrink-0 text-[var(--color-brand-text-muted)]" aria-hidden /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-brand-text-primary)]">{r.title}</p>
                    {r.sub ? <p className="truncate text-xs text-[var(--color-brand-text-muted)]">{r.sub}</p> : null}
                  </div>
                  {i === active ? <CornerDownLeft className="hidden size-3.5 shrink-0 text-[var(--color-brand-text-muted)] md:block" aria-hidden /> : null}
                </div>
              </li>
            ))}
            {liveHint ? <li role="presentation" className="px-4 py-3 text-xs text-[var(--color-brand-text-muted)]" aria-live="polite">{liveHint}</li> : null}
            {live.failed ? <li role="presentation" className="px-4 py-3 text-xs text-[var(--color-brand-text-muted)]">Could not search users and tickets right now.</li> : null}
            {liveEmpty && rows.length > 0 ? <li role="presentation" className="px-4 py-3 text-xs text-[var(--color-brand-text-muted)]">No matching users or tickets.</li> : null}
            {noResults ? <li role="presentation" className="px-4 py-8 text-center text-sm text-[var(--color-brand-text-muted)]">{query.trim().length < LIVE_MIN_CHARS ? 'Keep typing…' : 'Nothing found.'}</li> : null}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  )
}
