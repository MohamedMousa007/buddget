import { appHostFor, configuredAdminHost, normalizeHost } from '@/lib/admin/host'

/**
 * The Supabase auth cookie is shared across buddget.app and admin.buddget.app by giving it `Domain=.buddget.app`
 * in production. Sessions created before that have a host-only cookie of the same name; the browser keeps both,
 * sends the older (host-only) one first, and `cookie.parse` takes the first, so a stale token would shadow the
 * fresh one. Everything here exists to retire the host-only cookie safely.
 */
export const COOKIE_DOMAIN_MARKER = 'bdg-cookie-domain'
const AUTH_COOKIE = /^sb-.+-auth-token(\.\d+)?$/
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60

export interface RawCookie { name: string; value: string }

export function isAuthCookieName(name: string): boolean {
  return AUTH_COOKIE.test(name)
}

/** `.buddget.app` on the app or admin host, nothing on localhost and preview hosts. */
export function supabaseCookieDomain(hostname: string | null | undefined): string | undefined {
  const host = normalizeHost(hostname)
  const apex = appHostFor(configuredAdminHost())
  return apex && (host === apex || host.endsWith(`.${apex}`)) ? `.${apex}` : undefined
}

/**
 * Parses a Cookie header keeping the LAST value when a name repeats. With a host-only and a domain cookie of the
 * same name the browser lists the older one first, and the newer is the one that is current.
 */
export function parseCookiesPreferLast(header: string | null | undefined): RawCookie[] {
  const byName = new Map<string, string>()
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=')
    if (eq < 1) continue
    const name = part.slice(0, eq).trim()
    let value = part.slice(eq + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    try {
      value = decodeURIComponent(value)
    } catch {
      /* keep the raw value */
    }
    byName.delete(name)
    byName.set(name, value)
  }
  return [...byName].map(([name, value]) => ({ name, value }))
}

export interface CookieDomainPlan {
  /** Auth cookies read from the request that must be rewritten with the shared domain. */
  rewrite: RawCookie[]
  /** Names whose host-only variant must be expired (a `Set-Cookie` without `Domain`, `Max-Age=0`). */
  expireHostOnly: string[]
  /** Record that this host has been migrated so the work is not repeated on every request. */
  markDone: boolean
}

/**
 * Decides what a response must do about the host-only cookie. `written` are the auth cookies the response is
 * writing anyway (they already carry the domain). Without the marker, every auth cookie the request carried is
 * re-issued on the shared domain and its host-only twin expired; the marker cookie is host-only on purpose, so
 * each host migrates its own copy.
 */
export function planCookieDomain(args: { domain: string | undefined; cookieHeader: string | null | undefined; written: string[] }): CookieDomainPlan {
  const none: CookieDomainPlan = { rewrite: [], expireHostOnly: [], markDone: false }
  if (!args.domain) return none

  const incoming = parseCookiesPreferLast(args.cookieHeader)
  const migrated = incoming.some((c) => c.name === COOKIE_DOMAIN_MARKER)
  const expire = new Set(args.written.filter(isAuthCookieName))
  const rewrite: RawCookie[] = []
  if (!migrated) {
    for (const c of incoming) {
      if (!isAuthCookieName(c.name) || args.written.includes(c.name)) continue
      rewrite.push(c)
      expire.add(c.name)
    }
  }
  return { rewrite, expireHostOnly: [...expire], markDone: !migrated && expire.size > 0 }
}

export const domainCookieOptions = (domain: string) => ({ path: '/', domain, sameSite: 'lax' as const, secure: true, maxAge: MAX_AGE_SECONDS })

/**
 * Options the Supabase clients mint the auth cookie with: `Secure` whenever the page is https (always in production),
 * so the token never rides a plain-http request. HttpOnly is impossible here: the browser client reads the cookie.
 */
export const authCookieOptions = (domain: string | undefined, secure: boolean) => (domain ? { domain, secure } : { secure })
export const hostOnlyExpiryOptions = { path: '/', maxAge: 0 } as const
export const markerCookieOptions = { path: '/', sameSite: 'lax' as const, secure: true, maxAge: MAX_AGE_SECONDS }
