'use client'

import { Suspense, lazy, useCallback, useEffect, useState, type ComponentType } from 'react'
import { canAny, type Permission } from '@/lib/admin/permissions'
import { ADMIN_NAV } from '@/lib/admin/nav'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { AdminShell } from './AdminShell'
import { ADMIN_LOCKED_EVENT, adminFetch, adminPost, setAdminToken } from './adminClient'
import { adminNavigate, useAdminRoute } from './adminRouter'
import { AuthFrame } from './auth/AuthFrame'
import { NoAccess } from './auth/NoAccess'
import { SetupFlow } from './auth/SetupFlow'
import { UnlockScreen } from './auth/UnlockScreen'
import { StepUpProvider } from './ui/StepUp'
import { Loading } from './ui/Panel'
import type { AdminStatus } from './types'

const LOADERS: Record<string, () => Promise<{ default: ComponentType<{ status: AdminStatus }> }>> = {
  overview: () => import('./views/OverviewView'),
  analytics: () => import('./views/AnalyticsView'),
  users: () => import('./views/UsersView'),
  support: () => import('./views/SupportView'),
  sms: () => import('./views/SmsView'),
  platform: () => import('./views/PlatformView'),
  emails: () => import('./views/EmailsView'),
  flags: () => import('./views/FlagsView'),
  plans: () => import('./views/PlansView'),
  loyalty: () => import('./views/LoyaltyView'),
  staff: () => import('./views/StaffView'),
  audit: () => import('./views/AuditView'),
  security: () => import('./views/SecurityView'),
}
const VIEWS: Record<string, ComponentType<{ status: AdminStatus }>> = Object.fromEntries(
  Object.entries(LOADERS).map(([key, load]) => [key, lazy(load)]),
)

const STATUS_CACHE = 'bdg-admin-status'

/** The last unlocked status, so the portal can paint at once and confirm with the server behind it. */
function readCachedStatus(): AdminStatus | null {
  try {
    const raw = sessionStorage.getItem(STATUS_CACHE)
    const cached = raw ? (JSON.parse(raw) as AdminStatus) : null
    return cached?.isStaff && cached.session && new Date(cached.session.expiresAt).getTime() > Date.now() ? cached : null
  } catch {
    return null
  }
}

function writeCachedStatus(status: AdminStatus | null) {
  try {
    if (status?.isStaff && status.session) sessionStorage.setItem(STATUS_CACHE, JSON.stringify(status))
    else sessionStorage.removeItem(STATUS_CACHE)
  } catch {
    /* storage unavailable: the portal just waits for the server */
  }
}

/** The first section this person may open — used when the default (overview) is above their role. */
function firstAllowed(perms: ReadonlySet<string>): string {
  for (const g of ADMIN_NAV) {
    for (const i of g.items) if (i.anyOf.length === 0 || canAny(perms, i.anyOf as readonly Permission[])) return i.section
  }
  return 'security'
}

type Phase = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; status: AdminStatus }

export function AdminApp() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const route = useAdminRoute()

  const refresh = useCallback(async () => {
    try {
      const status = await adminFetch<AdminStatus>('/api/admin/auth/status')
      writeCachedStatus(status)
      setPhase({ kind: 'ready', status })
    } catch (e) {
      writeCachedStatus(null)
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'Could not reach the server.' })
    }
  }, [])

  useEffect(() => {
    // Paint the portal from the last known status and load the section's code while the server confirms.
    const cached = readCachedStatus()
    if (cached) setPhase({ kind: 'ready', status: cached })
    void LOADERS[route.section]?.()
    void refresh()
    const onLocked = () => void refresh()
    window.addEventListener(ADMIN_LOCKED_EVENT, onLocked)
    return () => window.removeEventListener(ADMIN_LOCKED_EVENT, onLocked)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only the section the page opened on is preloaded
  }, [refresh])

  const lock = useCallback(async () => {
    await adminPost('/api/admin/auth/logout', {}).catch(() => undefined)
    writeCachedStatus(null)
    setAdminToken(null)
    await refresh()
  }, [refresh])

  if (phase.kind === 'loading') {
    return <AuthFrame title="Opening the portal"><Loading rows={2} /></AuthFrame>
  }
  if (phase.kind === 'error') {
    return <AuthFrame title="Can’t reach the server"><EmptyState title={phase.message} /></AuthFrame>
  }

  const { status } = phase
  if (!status.isStaff) return <NoAccess signedIn={status.signedIn !== false} />

  if (status.setup !== 'complete') {
    return <SetupFlow email={status.staff?.email ?? ''} resume={status.setup === 'confirm_email'} onDone={() => void refresh()} />
  }
  if (!status.session) {
    return <UnlockScreen name={status.staff?.name ?? ''} email={status.staff?.email ?? ''} biometricEnrolled={!!status.biometricEnrolled} onUnlocked={() => void refresh()} />
  }

  const perms = new Set(status.permissions ?? [])
  const navItem = ADMIN_NAV.flatMap((g) => g.items).find((i) => i.section === route.section)
  const allowed = navItem && (navItem.anyOf.length === 0 || canAny(perms, navItem.anyOf as readonly Permission[]))
  const View = allowed ? VIEWS[route.section] : undefined

  if (!View) {
    // A deep link to a section this role cannot see lands on the first one it can.
    queueMicrotask(() => adminNavigate(firstAllowed(perms), {}, { replace: true }))
    return null
  }

  return (
    <StepUpProvider>
      <AdminShell status={status} onLock={() => void lock()}>
        <Suspense fallback={<Card padding="lg"><Loading rows={6} /></Card>}>
          <View status={status} />
        </Suspense>
      </AdminShell>
    </StepUpProvider>
  )
}
