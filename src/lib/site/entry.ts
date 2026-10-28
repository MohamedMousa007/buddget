import type { SiteLocale } from './config'

/** Public website routes live under /en and /ar. Everything else belongs to the app. */
export function isSitePath(pathname: string): boolean {
  return /^\/(en|ar)(\/|$)/.test(pathname)
}

/** Supabase stores its session in `sb-<project>-auth-token` cookies (chunked as `.0`, `.1`). */
export function hasAuthCookie(names: readonly string[]): boolean {
  return names.some((n) => /^sb-.+-auth-token(\.\d+)?$/.test(n))
}

/** Arabic unless the browser clearly prefers English. */
export function pickSiteLocale(acceptLanguage: string | null): SiteLocale {
  if (!acceptLanguage) return 'ar'
  for (const part of acceptLanguage.split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase()
    if (tag.startsWith('ar')) return 'ar'
    if (tag.startsWith('en')) return 'en'
  }
  return 'ar'
}

/**
 * The app owns `/` for signed-in people. A visitor with no session sees the website instead,
 * served from /ar or /en without changing the address bar.
 */
export function siteHomeRewrite(input: { pathname: string; hasSession: boolean; acceptLanguage: string | null }): string | null {
  if (input.pathname !== '/' || input.hasSession) return null
  return `/${pickSiteLocale(input.acceptLanguage)}`
}

/**
 * Brochure pages are statically generated, so Next's inline hydration scripts carry no nonce.
 * They hold no account data, which is what makes allowing inline scripts acceptable here.
 */
export const SITE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

export type HostSplit = { marketing: string; app: string }

/**
 * Two-host mode: the website on the root domain, the product on its own subdomain. Off until
 * NEXT_PUBLIC_MY_HOST is set, so nothing changes before DNS and Supabase are ready.
 */
export function splitHosts(env: { my?: string; marketing?: string } = { my: process.env.NEXT_PUBLIC_MY_HOST, marketing: process.env.NEXT_PUBLIC_MARKETING_HOST }): HostSplit | null {
  const app = env.my?.trim().toLowerCase()
  if (!app) return null
  const marketing = env.marketing?.trim().toLowerCase() || app.split('.').slice(1).join('.')
  return marketing ? { marketing, app } : null
}

/** Paths the root domain keeps serving besides the website: shared APIs, auth callbacks, legal pages and static files. */
const MARKETING_PASSTHROUGH = ['/api/', '/_next/', '/site/', '/icons/', '/legal/', '/.well-known/', '/auth/callback', '/reset-password', '/privacy', '/terms']
const MARKETING_FILES = new Set(['/robots.txt', '/sitemap.xml', '/llms.txt', '/favicon.ico', '/og-en.png', '/og-ar.png', '/opengraph-image.png'])

export type SiteRoute = { kind: 'next' } | { kind: 'rewrite'; pathname: string } | { kind: 'redirect'; url: string } | { kind: 'robots-closed' }

export function decideSiteRoute(input: {
  host: string
  pathname: string
  search: string
  hasSession: boolean
  acceptLanguage: string | null
  split: HostSplit | null
}): SiteRoute {
  const { host, pathname, search, split } = input
  if (!split) {
    const home = siteHomeRewrite({ pathname, hasSession: input.hasSession, acceptLanguage: input.acceptLanguage })
    return home ? { kind: 'rewrite', pathname: home } : { kind: 'next' }
  }
  if (host === `www.${split.marketing}`) return { kind: 'redirect', url: `https://${split.marketing}${pathname}${search}` }
  if (host === split.marketing) {
    if (pathname === '/') return { kind: 'rewrite', pathname: `/${pickSiteLocale(input.acceptLanguage)}` }
    if (isSitePath(pathname) || MARKETING_FILES.has(pathname) || MARKETING_PASSTHROUGH.some((p) => pathname === p || pathname.startsWith(p))) return { kind: 'next' }
    return { kind: 'redirect', url: `https://${split.app}${pathname}${search}` }
  }
  if (host === split.app) {
    if (pathname === '/robots.txt') return { kind: 'robots-closed' }
    if (isSitePath(pathname)) return { kind: 'redirect', url: `https://${split.marketing}${pathname}${search}` }
  }
  return { kind: 'next' }
}
