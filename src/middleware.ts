import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseCookieToSet } from '@/lib/supabase/cookieTypes'

/** Simple in-process limiter for unauthenticated public FX/gold routes (best-effort per isolate). */
const PUBLIC_API_WINDOW_MS = 60_000
const PUBLIC_API_MAX = 120
const publicApiHits = new Map<string, number[]>()

function publicApiRateLimitOk(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - PUBLIC_API_WINDOW_MS
  const prev = publicApiHits.get(ip) ?? []
  const recent = prev.filter((t) => t > windowStart)
  recent.push(now)
  publicApiHits.set(ip, recent)
  return recent.length <= PUBLIC_API_MAX
}

const AUTH_CALLBACK = '/auth/callback'
const ONBOARDING_PATH = '/onboarding'

function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  )
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

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
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    return supabaseResponse
  }

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
  const isOnboarding = pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`)
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

  const onboardingDone = user.user_metadata?.onboarding_completed === true
  const onboardingRedo = request.nextUrl.searchParams.get('redo') === '1'

  if (!onboardingDone && !isOnboarding) {
    const url = request.nextUrl.clone()
    url.pathname = ONBOARDING_PATH
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (onboardingDone && isOnboarding && !onboardingRedo) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
