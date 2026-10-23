import { NextResponse } from 'next/server'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { stampDataReset, wipeUserData } from '@/lib/server/userData'

/**
 * Wipe all financial data for the authenticated user without deleting their
 * account. Supports cookie auth (web) and Bearer JWT (native Capacitor).
 */
export async function POST(request: Request) {
  try {
    const uid = await resolveApiUserId(request)
    if (!uid) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const admin = createServiceRoleClient()
    const errors = [...(await wipeUserData(admin, uid)), ...(await stampDataReset(admin, uid, { clearProfile: false }))]

    if (errors.length > 0) {
      console.error('[account/reset-data] partial failures:', errors)
    }

    return NextResponse.json({ ok: true, partialErrors: errors.length ? errors : undefined })
  } catch (e) {
    console.error('[account/reset-data] unexpected failure', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
