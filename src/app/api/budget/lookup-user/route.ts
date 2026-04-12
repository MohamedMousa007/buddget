import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import {
  countLookupsLastHour,
  isOverLookupLimit,
  logEmailLookup,
} from '@/lib/budget/inviteRateLimit'

const bodySchema = z.object({
  email: z.string().email().max(320),
})

/**
 * POST /api/budget/lookup-user
 * Returns display name only when a Buddget account exists for this email (no email echoed).
 */
export async function POST(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceRoleClient()
  const lookups = await countLookupsLastHour(service, user.id)
  if (isOverLookupLimit(lookups)) {
    return NextResponse.json({ error: 'Too many lookups. Try again later.' }, { status: 429 })
  }

  await logEmailLookup(service, user.id)

  const { data: raw, error } = await service.rpc('admin_lookup_user_by_email', {
    p_email: parsed.data.email.trim(),
  })

  if (error) {
    console.error('[lookup-user]', error.message)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }

  const row = raw as { found?: boolean; userId?: string; displayName?: string } | null
  if (!row || row.found !== true) {
    return NextResponse.json({ found: false as const })
  }

  return NextResponse.json({
    found: true as const,
    displayName: typeof row.displayName === 'string' ? row.displayName : '',
  })
}
