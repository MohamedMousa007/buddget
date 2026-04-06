import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { insertNotificationForUser } from '@/lib/notifications/insertServerNotification'

const patchSchema = z.object({
  memberId: z.string().uuid(),
  action: z.enum(['accept', 'decline']),
})

/**
 * PATCH /api/budget/members — accept or decline a pending invite (invitee only).
 */
export async function PATCH(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: row, error: fetchErr } = await supabase
    .from('shared_budget_members')
    .select('id, plan_id, user_id, status, invited_by')
    .eq('id', parsed.data.memberId)
    .maybeSingle()

  if (fetchErr || !row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (row.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (row.status !== 'pending') {
    return NextResponse.json({ error: 'Invite is no longer pending' }, { status: 409 })
  }

  const nextStatus = parsed.data.action === 'accept' ? 'accepted' : 'declined'
  const { error: upErr } = await supabase
    .from('shared_budget_members')
    .update({
      status: nextStatus,
      accepted_at: parsed.data.action === 'accept' ? new Date().toISOString() : null,
    })
    .eq('id', row.id)

  if (upErr) {
    console.error('[members PATCH]', upErr.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  const { data: plan } = await supabase
    .from('shared_budget_plans')
    .select('name, owner_id')
    .eq('id', row.plan_id)
    .maybeSingle()

  if (plan?.owner_id) {
    const inviteeName =
      (await supabase.from('user_profiles').select('display_name').eq('user_id', user.id).maybeSingle())
        .data?.display_name?.trim() || 'A member'

    if (parsed.data.action === 'accept') {
      await insertNotificationForUser({
        userId: plan.owner_id,
        type: 'budget_accepted',
        title: `${inviteeName} joined “${plan.name}”`,
        body: 'They accepted your budget invite.',
        metadata: { plan_id: row.plan_id },
      })
    } else {
      await insertNotificationForUser({
        userId: plan.owner_id,
        type: 'budget_declined',
        title: `${inviteeName} declined “${plan.name}”`,
        body: 'They declined your budget invite.',
        metadata: { plan_id: row.plan_id },
      })
    }
  }

  return NextResponse.json({ ok: true, status: nextStatus })
}
