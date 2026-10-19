import { NextResponse } from 'next/server'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { deleteUserCompletely } from '@/lib/server/deleteAccount'

/**
 * Permanently delete the authenticated user's account and every piece of data Buddget holds for them.
 *
 * Supports both cookie-based auth (web) and Bearer JWT (native Capacitor) via
 * resolveApiUserId — never pass a user id in the body.
 */
export async function POST(request: Request) {
  try {
    const uid = await resolveApiUserId(request)
    if (!uid) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const result = await deleteUserCompletely(createServiceRoleClient(), uid)
    if (!result.ok) {
      return NextResponse.json({ error: result.error, details: result.details }, { status: 500 })
    }
    if (result.partialErrors.length > 0) {
      console.error('[account/delete] partial failures:', result.partialErrors)
    }
    return NextResponse.json({ ok: true, partialErrors: result.partialErrors.length ? result.partialErrors : undefined })
  } catch (e) {
    console.error('[account/delete] unexpected failure', e)
    return NextResponse.json({ error: 'Unexpected failure' }, { status: 500 })
  }
}
