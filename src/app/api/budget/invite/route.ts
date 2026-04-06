import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import {
  countInvitesLast24h,
  isOverInviteLimit,
} from '@/lib/budget/inviteRateLimit'
import { sendBudgetInviteEmail } from '@/lib/email/sendBudgetInviteEmail'
import { insertNotificationForUser } from '@/lib/notifications/insertServerNotification'

const bodySchema = z.object({
  planId: z.string().uuid(),
  email: z.string().email().max(320),
  role: z.enum(['viewer', 'manager']),
  syncTransactions: z.boolean(),
})

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * POST /api/budget/invite — invite by email (existing Buddget user gets in-app notification).
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
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { planId, role, syncTransactions } = parsed.data
  const email = normalizeEmail(parsed.data.email)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceRoleClient()
  const inviteCount = await countInvitesLast24h(service, user.id)
  if (isOverInviteLimit(inviteCount)) {
    return NextResponse.json(
      { error: 'Invitation limit reached for today. Try again tomorrow.' },
      { status: 429 }
    )
  }

  const { data: plan, error: planErr } = await supabase
    .from('shared_budget_plans')
    .select('id, name, owner_id')
    .eq('id', planId)
    .maybeSingle()

  if (planErr || !plan || plan.owner_id !== user.id) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  const { data: lookupRaw, error: lookupErr } = await service.rpc('admin_lookup_user_by_email', {
    p_email: email,
  })

  if (lookupErr) {
    console.error('[invite lookup]', lookupErr.message)
    return NextResponse.json({ error: 'Invite failed' }, { status: 500 })
  }

  const lookup = lookupRaw as { found?: boolean; userId?: string; displayName?: string } | null
  const inviterName =
    (await supabase.from('user_profiles').select('display_name').eq('user_id', user.id).maybeSingle())
      .data?.display_name?.trim() || 'Someone'

  const memberRole = role === 'manager' ? 'manager' : 'viewer'
  const sync = role === 'manager' ? syncTransactions : false

  if (lookup?.found === true && lookup.userId) {
    if (lookup.userId === user.id) {
      return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 })
    }

    const { data: existing, error: exErr } = await supabase
      .from('shared_budget_members')
      .select('id, status')
      .eq('plan_id', planId)
      .eq('user_id', lookup.userId)
      .maybeSingle()

    if (exErr) {
      console.error('[invite existing check]', exErr.message)
      return NextResponse.json({ error: 'Invite failed' }, { status: 500 })
    }
    if (existing && existing.status !== 'declined') {
      return NextResponse.json({ error: 'User already invited or a member' }, { status: 409 })
    }

    const { data: insertedMember, error: insErr } = await supabase
      .from('shared_budget_members')
      .insert({
        plan_id: planId,
        user_id: lookup.userId,
        invited_email: email,
        invited_by: user.id,
        role: memberRole,
        sync_transactions: sync,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insErr || !insertedMember) {
      console.error('[invite insert member]', insErr?.message)
      return NextResponse.json({ error: 'Could not send invite' }, { status: 500 })
    }

    await insertNotificationForUser({
      userId: lookup.userId,
      type: 'budget_invite',
      title: `${inviterName} invited you to “${plan.name}”`,
      body:
        role === 'manager' ?
          sync ?
            'Permission: Can manage · Transactions synced'
          : 'Permission: Can manage'
        : 'Permission: View only',
      metadata: {
        plan_id: planId,
        member_id: insertedMember.id,
        plan_name: plan.name,
        inviter_name: inviterName,
        role: memberRole,
        sync_transactions: sync,
      },
    })

    return NextResponse.json({ ok: true, kind: 'existing_user' as const })
  }

  const { data: dupEmail } = await supabase
    .from('shared_budget_members')
    .select('id')
    .eq('plan_id', planId)
    .eq('invited_email', email)
    .maybeSingle()

  if (dupEmail) {
    return NextResponse.json({ error: 'This email was already invited' }, { status: 409 })
  }

  const { data: inserted, error: insErr } = await supabase
    .from('shared_budget_members')
    .insert({
      plan_id: planId,
      user_id: null,
      invited_email: email,
      invited_by: user.id,
      role: memberRole,
      sync_transactions: sync,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insErr || !inserted) {
    console.error('[invite insert pending]', insErr?.message)
    return NextResponse.json({ error: 'Could not create invite' }, { status: 500 })
  }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()

  const { error: tokErr } = await service.from('budget_invite_tokens').insert({
    token,
    plan_id: planId,
    member_id: inserted.id,
    invited_email: email,
    expires_at: expiresAt,
  })

  if (tokErr) {
    console.error('[invite token]', tokErr.message)
    return NextResponse.json({ error: 'Could not create invite link' }, { status: 500 })
  }

  const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN || 'https://buddget.online'
  const joinUrl = `${appOrigin.replace(/\/$/, '')}/?invite=${encodeURIComponent(token)}`

  const permissionLabel =
    role === 'manager' ?
      sync ?
        'view and manage (with transactions synced)'
      : 'view and manage'
    : 'view'

  await sendBudgetInviteEmail({
    to: email,
    inviterName,
    planName: plan.name,
    permissionLabel,
    joinUrl,
  })

  return NextResponse.json({ ok: true, kind: 'email_sent' as const })
}
