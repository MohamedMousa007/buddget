import { NextResponse, type NextRequest } from 'next/server'
import { INVITE_COOKIE, normalizeInviteCode } from '@/components/features/invite/inviteCode'

const THIRTY_DAYS = 60 * 60 * 24 * 30

/**
 * An invite link: remembers the code in a cookie the app reads after sign-up, then opens the app with the sign-up sheet.
 * No database call: the code is checked when it is redeemed. A link that cannot be a code just opens the app.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeInviteCode((await params).code)
  const target = new URL(code ? '/flow?next=%2Fflow' : '/', request.url)
  const response = NextResponse.redirect(target, 307)
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('X-Robots-Tag', 'noindex')
  if (code) response.cookies.set(INVITE_COOKIE, code, { maxAge: THIRTY_DAYS, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', httpOnly: false })
  return response
}
