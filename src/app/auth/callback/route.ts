import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Only allow same-origin relative paths to prevent open redirects.
 * Rejects `//`, absolute URLs, and paths containing `://`.
 */
function safeRedirect(origin: string, next: string): string {
  const n = next.trim()
  if (!n.startsWith('/') || n.startsWith('//')) {
    return `${origin}/`
  }
  if (n.includes('://')) {
    return `${origin}/`
  }
  try {
    const resolved = new URL(n, origin)
    if (resolved.origin !== new URL(origin).origin) {
      return `${origin}/`
    }
  } catch {
    return `${origin}/`
  }
  return `${origin}${n}`
}

function oauthFailureRedirect(origin: string, reason: string): string {
  const params = new URLSearchParams({ error: 'oauth', reason })
  return `${origin}/?${params.toString()}`
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const oauthError = requestUrl.searchParams.get('error')
  const oauthErrorDescription = requestUrl.searchParams.get('error_description')
  const nextParam = requestUrl.searchParams.get('next') ?? '/'
  const origin = requestUrl.origin
  const destination = safeRedirect(origin, nextParam)

  if (oauthError) {
    const reason =
      oauthError === 'access_denied'
        ? 'access_denied'
        : oauthErrorDescription?.trim() || oauthError
    return NextResponse.redirect(oauthFailureRedirect(origin, reason))
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(destination)
    }
    return NextResponse.redirect(oauthFailureRedirect(origin, 'exchange_failed'))
  }

  return NextResponse.redirect(oauthFailureRedirect(origin, 'missing_code'))
}
