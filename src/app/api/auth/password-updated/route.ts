import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

/**
 * Short-lived HttpOnly cookie that signals "a password reset just completed".
 *
 * Replaces the forgeable `?passwordUpdated=1` query param. Only `POST /api/auth/password/change` sets the cookie, after it
 * has verified the caller and changed the password; nothing here writes it, so a visitor cannot forge the success modal.
 *   GET  /api/auth/password-updated  → returns {pending: boolean}, clears cookie
 *
 * AuthProvider polls the GET on mount. Max-age 60 s is plenty for the redirect hop.
 */

const COOKIE_NAME = 'buddget_password_updated'

export async function GET() {
  const c = await cookies()
  const pending = c.get(COOKIE_NAME)?.value === '1'
  if (pending) c.set(COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return NextResponse.json({ pending })
}
