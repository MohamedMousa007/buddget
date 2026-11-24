import { NextResponse } from 'next/server'
import { z } from 'zod'
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { CSAT_COMMENT_MAX } from '@/lib/support/conversation'

type Params = { params: Promise<{ number: string }> }

const bodySchema = z.object({ rating: z.union([z.literal(1), z.literal(-1)]), comment: z.string().trim().max(CSAT_COMMENT_MAX).optional() })

/**
 * "How did we do?" on a resolved request, once. One conditional update does the ownership, state and write-once checks
 * together, so two taps or two devices can never both land.
 */
export async function POST(request: Request, { params }: Params) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const uid = await resolveApiUserId(request)
  if (!uid) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const number = Number((await params).number)
  if (!Number.isInteger(number) || number <= 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { data, error } = await createServiceRoleClient()
    .from('support_tickets')
    .update({ csat_rating: parsed.data.rating, csat_comment: parsed.data.comment || null, csat_at: new Date().toISOString() })
    .eq('number', number)
    .eq('user_id', uid)
    .in('status', ['resolved', 'closed'])
    .is('csat_rating', null)
    .select('number')
  if (error) return NextResponse.json({ error: 'Could not save that' }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Already rated or not resolved' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
