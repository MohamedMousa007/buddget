import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveRouteUser, resolveVerifiedIdentity } from '@/lib/supabase/resolveRouteUser'
import { verifyReauth } from '@/lib/server/reauth'
import { recordSecondFactor } from '@/lib/server/secondFactor'

const bodySchema = z.object({ enabled: z.boolean(), currentPassword: z.string().min(1).max(256).optional() })

/**
 * The only way to switch email 2-step on or off. Turning it off needs re-authentication (current password, or a fresh
 * email-code / identity-provider sign-in); turning it on marks this session as verified so the user is not gated out
 * of the session they just secured.
 */
export async function POST(request: Request) {
  try {
    const identity = await resolveVerifiedIdentity(request)
    if (!identity) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const parsed = bodySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const admin = createServiceRoleClient()
    if (!parsed.data.enabled) {
      const { user } = await resolveRouteUser(request)
      if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      const verdict = await verifyReauth(admin, identity, user, parsed.data.currentPassword)
      if (verdict === 'rate_limited') return NextResponse.json({ error: 'Too many attempts, try again later' }, { status: 429 })
      if (verdict === 'wrong_password') return NextResponse.json({ error: 'Wrong password', code: 'wrong_password' }, { status: 403 })
      if (verdict === 'reauth_required') return NextResponse.json({ error: 'Confirm it is you first', code: 'reauth_required' }, { status: 403 })
    }

    const { error } = await admin.from('user_settings').upsert({ user_id: identity.id, two_factor_email_enabled: parsed.data.enabled }, { onConflict: 'user_id' })
    if (error) {
      console.error('[auth/two-factor] write failed', error.message)
      return NextResponse.json({ error: 'Could not change 2-step verification' }, { status: 500 })
    }
    if (parsed.data.enabled) await recordSecondFactor(admin, identity, 'enabled_here')
    return NextResponse.json({ ok: true, enabled: parsed.data.enabled })
  } catch (e) {
    console.error('[auth/two-factor] unexpected', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
