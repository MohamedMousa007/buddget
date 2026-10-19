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

const VIEWS: Record<string, ComponentType<{ status: AdminStatus }>> = {
  overview: lazy(() => import('./views/OverviewView')),
  analytics: lazy(() => import('./views/AnalyticsView')),
  users: lazy(() => import('./views/UsersView')),
  support: lazy(() => import('./views/SupportView')),
  sms: lazy(() => import('./views/SmsView')),
  platform: lazy(() => import('./views/PlatformView')),
  flags: lazy(() => import('./views/FlagsView')),
  plans: lazy(() => import('./views/PlansView')),
  loyalty: lazy(() => import('./views/LoyaltyView')),
  staff: lazy(() => import('./views/StaffView')),
  audit: lazy(() => import('./views/AuditView')),
  security: lazy(() => import('./views/SecurityView')),
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
      setPhase({ kind: 'ready', status: await adminFetch<AdminStatus>('/api/admin/auth/status') })
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'Could not reach the server.' })
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial status fetch
    void refresh()
    const onLocked = () => void refresh()
    window.addEventListener(ADMIN_LOCKED_EVENT, onLocked)
    return () => window.removeEventListener(ADMIN_LOCKED_EVENT, onLocked)
  }, [refresh])

  const lock = useCallback(async () => {
    await adminPost('/api/admin/auth/logout', {}).catch(() => undefined)
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
