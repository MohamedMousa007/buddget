import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseCookieToSet } from '@/lib/supabase/cookieTypes'
import {
  isSupabaseConfigured,
  requireSupabasePublishableKey,
  requireSupabaseUrl,
} from '@/lib/supabase/env'
import { nativeApiPreflightResponse, withNativeApiCors } from '@/lib/server/nativeApiCors'

/** Simple in-process limiter for unauthenticated public FX/gold routes (best-effort per isolate). */
const PUBLIC_API_WINDOW_MS = 60_000
const PUBLIC_API_MAX = 120
const MAX_TRACKED_IPS = 10000
const publicApiHits = new Map<string, number[]>()

function publicApiRateLimitOk(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - PUBLIC_API_WINDOW_MS
  const prev = publicApiHits.get(ip) ?? []
  const recent = prev.filter((t) => t > windowStart)
  recent.push(now)
  publicApiHits.set(ip, recent)

  // Cleanup: if map grows unbounded, evict IPs with empty hit arrays
  if (publicApiHits.size > MAX_TRACKED_IPS) {
    for (const [trackedIp, hits] of publicApiHits.entries()) {
      if (hits.length === 0) {
        publicApiHits.delete(trackedIp)
      }
    }
  }

  return recent.length <= PUBLIC_API_MAX
}

const AUTH_CALLBACK = '/auth/callback'

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://open.er-api.com https://api.frankfurter.dev https://api.frankfurter.app https://metals.live https://api.metals.live https://gold-api.com https://fcm.googleapis.com https://*.push.services.mozilla.com https://updates.push.services.mozilla.com https://*.notify.windows.com https://web.push.apple.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

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
    if (!publicApiRateLimitOk(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
  }

  if (!isSupabaseConfigured()) {
    if (pathname.startsWith('/api')) {
      return withNativeApiCors(request, NextResponse.next())
    }
    const response = NextResponse.next({ request })
    response.headers.set('Content-Security-Policy', csp)
    return response
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    requireSupabaseUrl(),
    requireSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: SupabaseCookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

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
  const isAdmin = pathname.startsWith('/admin')

  if (isAuthCallback || isResetPassword) {
    return supabaseResponse
  }

  if (!user) {
    if (isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // /admin requires a signed-in account (PIN still required inside the app / APIs)
  if (isAdmin) {
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
