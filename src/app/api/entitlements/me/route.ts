import { NextResponse } from 'next/server'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { getUserEntitlements } from '@/lib/entitlements/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

/** What the signed-in user's plan allows. The app reads this once gating (freemium, trials) ships. */
export async function GET(request: Request) {
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const entitlements = await getUserEntitlements(createServiceRoleClient(), uid)
  return NextResponse.json(entitlements, { headers: { 'Cache-Control': 'private, no-store' } })
}
