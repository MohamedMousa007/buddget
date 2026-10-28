import { createServerClient, serializeCookieHeader } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseCookieToSet } from '@/lib/supabase/cookieTypes'
import {
  isSupabaseConfigured,
  requireSupabasePublishableKey,
  requireSupabaseUrl,
} from '@/lib/supabase/env'
import { publicApiRateLimitOk } from '@/lib/server/publicApiRateLimit'
import { nativeApiPreflightResponse, withNativeApiCors } from '@/lib/server/nativeApiCors'
import { SITE_CSP, decideSiteRoute, hasAuthCookie, isSitePath, splitHosts } from '@/lib/site/entry'
import { appHostForRedirects, configuredAdminHost, decideHostRoute, normalizeHost } from '@/lib/admin/host'
import {
  COOKIE_DOMAIN_MARKER,
  domainCookieOptions,
  hostOnlyExpiryOptions,
  markerCookieOptions,
  parseCookiesPreferLast,
  planCookieDomain,
  supabaseCookieDomain,
} from '@/lib/supabase/cookieDomain'

const AUTH_CALLBACK = '/auth/callback'
const AUTH_CHECK_TIMEOUT_MS = 1500

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // Dev only: React Refresh evaluates modules, so `next dev` never hydrates without it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://open.er-api.com https://api.frankfurter.dev https://api.frankfurter.app https://metals.live https://api.metals.live https://gold-api.com https://fcm.googleapis.com https://*.push.services.mozilla.com https://updates.push.services.mozilla.com https://*.notify.windows.com https://web.push.apple.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.ingest.us.sentry.io",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host')
  const hostRoute = decideHostRoute({ host, pathname: request.nextUrl.pathname, search: request.nextUrl.search })
  if (hostRoute.kind === 'redirect') return NextResponse.redirect(hostRoute.url, 307)
  const onAdminHost = normalizeHost(host) === configuredAdminHost()
  // On the admin host `/` is served by the /admin page; every check below sees the page that is really served.
  const pathname = hostRoute.kind === 'rewrite' ? hostRoute.pathname : request.nextUrl.pathname
  const next = () => {
    if (hostRoute.kind !== 'rewrite') return NextResponse.next({ request })
    const url = request.nextUrl.clone()
    url.pathname = hostRoute.pathname
    return NextResponse.rewrite(url, { request })
  }

  // The public website is static and anonymous: skip the session refresh entirely.
  if (!onAdminHost) {
    const route = decideSiteRoute({
      host: normalizeHost(host),
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      hasSession: hasAuthCookie(request.cookies.getAll().map((c) => c.name)),
      acceptLanguage: request.headers.get('accept-language'),
      split: splitHosts(),
    })
    if (route.kind === 'redirect') return NextResponse.redirect(route.url, 308)
    if (route.kind === 'robots-closed') {
      return new NextResponse('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain', 'X-Robots-Tag': 'noindex' } })
    }
    const onWebsite = route.kind === 'rewrite' || isSitePath(request.nextUrl.pathname)
    if (onWebsite) {
      const url = request.nextUrl.clone()
      if (route.kind === 'rewrite') url.pathname = route.pathname
      const response = route.kind === 'rewrite' ? NextResponse.rewrite(url) : NextResponse.next()
      response.headers.set('Content-Security-Policy', SITE_CSP)
      if (route.kind === 'rewrite') response.headers.set('Vary', 'Cookie, Accept-Language')
      return response
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = buildCsp(nonce)
  request.headers.set('x-nonce', nonce)

  if (pathname.startsWith('/api')) {
    const preflight = nativeApiPreflightResponse(request)
    if (preflight) return preflight
  }

  if (pathname.startsWith('/api/gold') || pathname.startsWith('/api/rates')) {
    const forwarded = request.headers.get('x-forwarded-for')
    const ip =
      forwarded?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip')?.trim() ||
      'unknown'
    if (!(await publicApiRateLimitOk(ip))) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
  }

  if (!isSupabaseConfigured()) {
    if (pathname.startsWith('/api')) {
      return withNativeApiCors(request, NextResponse.next())
    }
    const response = next()
    response.headers.set('Content-Security-Policy', csp)
    return response
  }

  let supabaseResponse = next()
  const cookieDomain = supabaseCookieDomain(request.nextUrl.hostname)
  const writtenAuthCookies = new Set<string>()

  const supabase = createServerClient(
    requireSupabaseUrl(),
    requireSupabasePublishableKey(),
    {
      cookieOptions: cookieDomain ? { domain: cookieDomain } : undefined,
      cookies: {
        getAll() {
          return cookieDomain ? parseCookiesPreferLast(request.headers.get('cookie')) : request.cookies.getAll()
        },
        setAll(cookiesToSet: SupabaseCookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
            writtenAuthCookies.add(name)
          })
          supabaseResponse = next()
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Never let a slow auth backend take the whole site down (504 MIDDLEWARE_INVOCATION_TIMEOUT):
  // the session refresh is best-effort, the client refreshes its own session.
  const user = await Promise.race([
    supabase.auth.getClaims().then((r) => r.data?.claims ?? null, () => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), AUTH_CHECK_TIMEOUT_MS)),
  ])

  // Retire host-only auth cookies once the shared-domain cookie is in use (see cookieDomain.ts). Raw Set-Cookie
  // headers: a response cookie jar is keyed by name and could not hold the domain cookie and its host-only expiry.
  const plan = planCookieDomain({ domain: cookieDomain, cookieHeader: request.headers.get('cookie'), written: [...writtenAuthCookies] })
  if (cookieDomain) {
    plan.rewrite.forEach(({ name, value }) => supabaseResponse.cookies.set(name, value, domainCookieOptions(cookieDomain)))
    if (plan.markDone) supabaseResponse.cookies.set(COOKIE_DOMAIN_MARKER, '1', markerCookieOptions)
    plan.expireHostOnly.forEach((name) => supabaseResponse.headers.append('Set-Cookie', serializeCookieHeader(name, '', hostOnlyExpiryOptions)))
  }

  // The portal and its API never get cached or indexed, whatever sits in front of the app.
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    supabaseResponse.headers.set('Cache-Control', 'no-store')
    supabaseResponse.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  if (pathname.startsWith('/api')) {
    return withNativeApiCors(request, supabaseResponse)
  }

  supabaseResponse.headers.set('Content-Security-Policy', csp)

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/sw.js') ||
    pathname.startsWith('/workbox-') ||
    pathname.startsWith('/fallback-')
  ) {
    return supabaseResponse
  }

  const isPublicMarketing =
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname === '/sitemap.xml' ||
    pathname === '/robots.txt' ||
    pathname.startsWith('/opengraph-image')

  if (isPublicMarketing) {
    return supabaseResponse
  }

  const isAuthCallback = pathname === AUTH_CALLBACK || pathname.startsWith(`${AUTH_CALLBACK}/`)
  const isResetPassword = pathname.startsWith('/reset-password')
  const isAdmin = pathname.startsWith('/admin') && pathname !== '/admin/accept'

  if (isAuthCallback || isResetPassword) {
    return supabaseResponse
  }

  if (!user) {
    if (isAdmin) {
      if (onAdminHost) return NextResponse.redirect(`https://${appHostForRedirects()}/`, 307)
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
