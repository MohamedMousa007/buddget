import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveDeviceId } from '@/lib/auth/resolveDeviceId'
import { resolveRouteUser, resolveVerifiedIdentity } from '@/lib/supabase/resolveRouteUser'
import { accessTokenOf, verifyReauth } from '@/lib/server/reauth'

const bodySchema = z.object({
  newPassword: z.string().min(8).max(256),
  currentPassword: z.string().min(1).max(256).optional(),
  /** Set the one-minute "password updated" cookie: for a reset that ends signed out, not for a change from settings. */
  announce: z.boolean().optional(),
})

/** Same bar as sign-up: letters and a digit. */
const strongEnough = (p: string) => /[A-Za-z]/.test(p) && /\d/.test(p)

/**
 * Changes the password. Needs the current password, or a recovery / email-code sign-in from the last ten minutes.
 * Order matters: the biometric and trusted-device bindings go first, then the password changes, then every OTHER session
 * is revoked; revoking sessions first would let a bound device mint a fresh session through /api/biometric/signin.
 * This device stays signed in and is re-trusted. Its biometric binding is cleared with the rest on purpose (decision: password change
 * clears every biometric binding); it re-enrols on the next biometric prompt. A failed revoke answers with an error, not ok.
 */
export async function POST(request: Request) {
  try {
    const identity = await resolveVerifiedIdentity(request)
    if (!identity) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success || !strongEnough(parsed.data.newPassword)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const { user } = await resolveRouteUser(request)
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const admin = createServiceRoleClient()
    const verdict = await verifyReauth(admin, identity, user, parsed.data.currentPassword)
    if (verdict === 'rate_limited') return NextResponse.json({ error: 'Too many attempts, try again later' }, { status: 429 })
    if (verdict === 'wrong_password') return NextResponse.json({ error: 'Wrong password', code: 'wrong_password' }, { status: 403 })
    if (verdict === 'reauth_required') return NextResponse.json({ error: 'Confirm it is you first', code: 'reauth_required' }, { status: 403 })

    const [bio, trusted] = await Promise.all([
      admin.from('biometric_devices').delete().eq('user_id', identity.id),
      admin.from('trusted_devices').delete().eq('user_id', identity.id),
    ])
    if (bio.error || trusted.error) {
      console.error('[auth/password] clearing device bindings failed', bio.error?.message, trusted.error?.message)
      return NextResponse.json({ error: 'Could not change the password' }, { status: 500 })
    }

    const updated = await admin.auth.admin.updateUserById(identity.id, { password: parsed.data.newPassword })
    if (updated.error) {
      const same = /same/i.test(updated.error.message) && /password/i.test(updated.error.message)
      return NextResponse.json({ error: same ? 'Same password' : 'Could not change the password', code: same ? 'same_password' : undefined }, { status: same ? 422 : 500 })
    }

    const token = await accessTokenOf(request)
    let revokedOthers = false
    if (token) {
      for (let attempt = 0; attempt < 2 && !revokedOthers; attempt++) {
        const revoked = await admin.auth.admin.signOut(token, 'others')
        if (revoked.error) console.error('[auth/password] revoking other sessions failed', revoked.error.message)
        else revokedOthers = true
      }
    }

    const deviceId = await resolveDeviceId(request)
    const trust = await admin.from('trusted_devices').upsert(
      { user_id: identity.id, device_id: deviceId, user_agent: (request.headers.get('user-agent') || '').slice(0, 500) || null, last_used_at: new Date().toISOString() },
      { onConflict: 'user_id,device_id' },
    )
    if (trust.error) console.error('[auth/password] re-trusting this device failed', trust.error.message)

    if (!revokedOthers) {
      return NextResponse.json(
        { error: 'Password changed, but other devices could not be signed out. Try again.', code: 'sessions_not_revoked', passwordChanged: true },
        { status: 502 },
      )
    }

    if (parsed.data.announce) (await cookies()).set('buddget_password_updated', '1', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[auth/password] unexpected', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
