/**
 * Host routing for the admin portal's own domain. The same deployment serves both hosts:
 * - admin host: `/` is the portal, only the portal and what it needs are exposed, everything else goes to the app;
 * - app host: `/admin` lives on the admin host;
 * - any other host (localhost, previews): untouched, so development keeps working.
 */
export const DEFAULT_ADMIN_HOST = 'admin.buddget.app'

export function configuredAdminHost(): string {
  return (process.env.NEXT_PUBLIC_ADMIN_HOST?.trim() || DEFAULT_ADMIN_HOST).toLowerCase()
}

/** `admin.buddget.app` -> `buddget.app` */
export function appHostFor(adminHost: string): string {
  return adminHost.split('.').slice(1).join('.')
}

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? '').trim().toLowerCase().replace(/:\d+$/, '')
}

export type HostDecision = { kind: 'next' } | { kind: 'rewrite'; pathname: string } | { kind: 'redirect'; url: string }

const ADMIN_HOST_ROOTS = ['/admin', '/auth/callback']
const ADMIN_HOST_PREFIXES = ['/api/', '/_next/', '/icons/', '/sw.js', '/workbox-', '/fallback-']
const ADMIN_HOST_FILES = new Set(['/favicon.ico', '/manifest.json'])

function underAdminHost(pathname: string): boolean {
  return (
    ADMIN_HOST_FILES.has(pathname) ||
    ADMIN_HOST_ROOTS.some((r) => pathname === r || pathname.startsWith(`${r}/`)) ||
    ADMIN_HOST_PREFIXES.some((p) => pathname.startsWith(p))
  )
}

export function decideHostRoute(
  input: { host: string | null | undefined; pathname: string; search?: string },
  adminHost: string = configuredAdminHost(),
): HostDecision {
  const host = normalizeHost(input.host)
  const appHost = appHostFor(adminHost)
  const search = input.search ?? ''

  if (host === adminHost) {
    if (input.pathname === '/') return { kind: 'rewrite', pathname: '/admin' }
    if (underAdminHost(input.pathname)) return { kind: 'next' }
    return { kind: 'redirect', url: `https://${appHost}${input.pathname}${search}` }
  }

  if (host === appHost && (input.pathname === '/admin' || input.pathname.startsWith('/admin/'))) {
    const path = input.pathname === '/admin' ? '/' : input.pathname
    return { kind: 'redirect', url: `https://${adminHost}${path}${search}` }
  }

  return { kind: 'next' }
}

/** Where emailed admin links point: the admin host in production, the app origin on localhost and previews. */
export function adminOriginFor(appOrigin: string, adminHost: string = configuredAdminHost()): string {
  let host = ''
  try {
    host = new URL(appOrigin).hostname
  } catch {
    /* relative or empty origin: fall through */
  }
  return host === appHostFor(adminHost) || host === adminHost ? `https://${adminHost}` : appOrigin
}
