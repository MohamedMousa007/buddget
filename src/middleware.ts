import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseCookieToSet } from '@/lib/supabase/cookieTypes'

const LOGIN_PATH = '/login'
const AUTH_CALLBACK = '/auth/callback'
const ONBOARDING_PATH = '/onboarding'

function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  )
}

export async function middleware(request: NextRequest) {
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

  const pathname = request.nextUrl.pathname

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

  const isLogin = pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)
  const isAuthCallback = pathname === AUTH_CALLBACK || pathname.startsWith(`${AUTH_CALLBACK}/`)
  const isOnboarding = pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`)
  const isAdmin = pathname.startsWith('/admin')

  if (isLogin || isAuthCallback) {
    if (user && isLogin) {
      const done = user.user_metadata?.onboarding_completed === true
      const url = request.nextUrl.clone()
      url.pathname = done ? '/' : ONBOARDING_PATH
      url.search = ''
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  if (isAdmin) {
    return supabaseResponse
  }

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = LOGIN_PATH
    url.searchParams.set('next', pathname + (request.nextUrl.search || ''))
    return NextResponse.redirect(url)
  }

  const onboardingDone = user.user_metadata?.onboarding_completed === true

  if (!onboardingDone && !isOnboarding) {
    const url = request.nextUrl.clone()
    url.pathname = ONBOARDING_PATH
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (onboardingDone && isOnboarding) {
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
