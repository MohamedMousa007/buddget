'use client'

import { useMemo, useState, type ReactNode } from 'react'
import * as Icons from 'lucide-react'
import { Menu, Lock, ArrowLeft, X } from 'lucide-react'
import { BuddgetWordmark } from '@/components/brand'
import { isNativeShellBuild } from '@/lib/native/isNative'
import { appOrigin } from '@/lib/apiBase'
import { navigate } from '@/lib/navigation/navigate'
import { AppLink } from '@/components/ui/AppLink'
import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/button'
import { Scrim } from '@/components/ui/Scrim'
import { ADMIN_NAV } from '@/lib/admin/nav'
import { canAny, type Permission } from '@/lib/admin/permissions'
import { cn } from '@/lib/utils'
import { adminNavigate, useAdminRoute } from './adminRouter'
import { AdminSearchButton } from './AdminSearch'
import { Pill } from './ui/Pill'
import type { AdminStatus } from './types'

function NavIcon({ name }: { name: string }) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Circle
  return <Icon className="size-[18px] shrink-0" aria-hidden />
}

export function AdminShell({ status, onLock, children }: { status: AdminStatus; onLock: () => void; children: ReactNode }) {
  const route = useAdminRoute()
  const [open, setOpen] = useState(false)
  const perms = useMemo(() => new Set(status.permissions ?? []), [status.permissions])

  const groups = useMemo(
    () =>
      ADMIN_NAV.map((g) => ({
        ...g,
        items: g.items.filter((i) => i.anyOf.length === 0 || canAny(perms, i.anyOf as readonly Permission[])),
      })).filter((g) => g.items.length > 0),
    [perms],
  )

  const nav = (
    <nav aria-label="Admin sections" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-text-muted)]">{g.label}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = route.section === item.section
              return (
                <li key={item.section}>
                  <a
                    href={`?s=${item.section}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={(e) => {
                      e.preventDefault()
                      setOpen(false)
                      adminNavigate(item.section)
                    }}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                      active
                        ? 'bg-[var(--color-brand-primary-soft)] text-[var(--color-brand-primary-ink)]'
                        : 'text-[var(--color-brand-text-secondary)] hover:bg-[var(--color-brand-elevated)] hover:text-[var(--color-brand-text-primary)]',
                    )}
                  >
                    <NavIcon name={item.icon} />
                    {item.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )

  const backToApp = () => {
    if (isNativeShellBuild()) navigate('/')
    else window.location.assign(`${appOrigin()}/`)
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--color-brand-border)] px-5">
        <BuddgetWordmark height={22} />
        <Pill tone="brand">Admin</Pill>
      </div>
      {nav}
      <div className="shrink-0 space-y-2 border-t border-[var(--color-brand-border)] p-3 safe-area-bottom">
        <div className="flex items-center gap-3 rounded-xl bg-[var(--color-brand-elevated)] px-3 py-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-brand-primary)] text-sm font-bold text-[var(--color-brand-on-primary)]">
            {(status.staff?.name?.trim() || status.staff?.email || '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--color-brand-text-primary)]">{status.staff?.name?.trim() || status.staff?.email}</p>
            <p className="truncate text-xs text-[var(--color-brand-text-muted)]">{status.staff?.roleName}</p>
          </div>
          {status.session?.method === 'sso' ? null : <IconButton aria-label="Lock the portal" size="sm" onClick={onLock}><Lock /></IconButton>}
        </div>
        {/* In the apps the portal is its own bundled page: a plain anchor reloads the app shell, and never leaves the bundle for the website. */}
        <AppLink href={isNativeShellBuild() ? '/' : `${appOrigin()}/`} onClick={isNativeShellBuild() ? (e) => { e.preventDefault(); navigate('/') } : undefined} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-[var(--color-brand-text-muted)] hover:text-[var(--color-brand-text-primary)]">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />Back to Buddget
        </AppLink>
      </div>
    </div>
  )

  return (
    <div className="min-h-[100dvh] overflow-x-clip bg-[var(--color-brand-bg)]">
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-64 border-e border-[var(--color-brand-border)] bg-[var(--color-brand-card)] lg:block">{sidebar}</aside>

      {open ? (
        <div className="lg:hidden">
          <Scrim label="Close menu" onClick={() => setOpen(false)} className="z-[60]" />
          <aside className="fixed inset-y-0 start-0 z-[61] w-72 max-w-[85vw] border-e border-[var(--color-brand-border)] bg-[var(--color-brand-card)] shadow-[var(--shadow-lg)]">
            <IconButton aria-label="Close menu" size="sm" className="absolute end-3 top-3 z-10" onClick={() => setOpen(false)}><X /></IconButton>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 lg:ps-64">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-[var(--color-brand-border)] bg-[var(--color-brand-card)]/90 px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] backdrop-blur-xl lg:px-8">
          <IconButton aria-label="Open menu" size="sm" className="lg:hidden" onClick={() => setOpen(true)}><Menu /></IconButton>
          <div className="min-w-0 lg:hidden"><BuddgetWordmark height={18} /></div>
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <AdminSearchButton perms={perms} />
            <IconButton aria-label="Back to Buddget app" title="Back to Buddget app" variant="outlined" size="sm" className="lg:hidden" onClick={backToApp}><ArrowLeft className="rtl:rotate-180" /></IconButton>
            <Button variant="outline" size="sm" aria-label="Back to Buddget app" title="Back to Buddget app" className="hidden lg:inline-flex" onClick={backToApp}>
              <ArrowLeft className="rtl:rotate-180" aria-hidden />Buddget
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] max-md:[&_button]:min-h-11 max-md:[&_input]:min-h-11 max-md:[&_select]:min-h-11 px-4 py-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] lg:px-8">{children}</main>
      </div>
    </div>
  )
}
