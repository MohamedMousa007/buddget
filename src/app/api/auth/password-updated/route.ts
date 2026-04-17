import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * Short-lived HttpOnly cookie that signals "a password reset just completed".
 *
 * Replaces the forgeable `?passwordUpdated=1` query param — now any visitor
 * can construct that URL and see the success modal. Flow:
 *   POST /api/auth/password-updated  → sets cookie, returns 204
 *   GET  /api/auth/password-updated  → returns {pending: boolean}, clears cookie
 *
 * AuthProvider polls the GET on mount; the confirm page POSTs before
 * redirecting to `/`. Max-age 60 s is plenty for the redirect hop.
 */

const COOKIE_NAME = 'buddget_password_updated'

export async function POST() {
  const c = await cookies()
  c.set(COOKIE_NAME, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60,
  })
  return new NextResponse(null, { status: 204 })
}

export async function GET() {
  const c = await cookies()
  const pending = c.get(COOKIE_NAME)?.value === '1'
  if (pending) c.set(COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return NextResponse.json({ pending })
}
