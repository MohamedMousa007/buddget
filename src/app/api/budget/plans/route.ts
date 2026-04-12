import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const createSchema = z.object({
  name: z.string().min(1).max(120).optional(),
})

/**
 * GET — shared plans owned by or shared with the current user.
 * POST — create a new shared plan (owner membership + empty data row).
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: owned, error: e1 } = await supabase
    .from('shared_budget_plans')
    .select('id, name, owner_id, created_at, updated_at')
    .eq('owner_id', user.id)

  if (e1) {
    console.error('[budget/plans GET owned]', e1.message)
    return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 })
  }

  const { data: memberRows, error: e2 } = await supabase
    .from('shared_budget_members')
    .select('id, plan_id, role, status, sync_transactions, user_id')
    .eq('user_id', user.id)
    .eq('status', 'accepted')
    .neq('role', 'owner')

  if (e2) {
    console.error('[budget/plans GET member]', e2.message)
    return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 })
  }

  const memberPlanIds = (memberRows ?? []).map((m) => m.plan_id)
  let memberPlans: typeof owned = []
  if (memberPlanIds.length > 0) {
    const { data: mp, error: e3 } = await supabase
      .from('shared_budget_plans')
      .select('id, name, owner_id, created_at, updated_at')
      .in('id', memberPlanIds)
    if (e3) {
      console.error('[budget/plans GET member plans]', e3.message)
    } else {
      memberPlans = mp ?? []
    }
  }

  const ownedIds = new Set((owned ?? []).map((p) => p.id))
  const merged = [...(owned ?? [])]
  for (const p of memberPlans) {
    if (!ownedIds.has(p.id)) merged.push(p)
  }

  return NextResponse.json({
    plans: merged.map((p) => ({
      ...p,
      membership:
        ownedIds.has(p.id) ?
          ({ kind: 'owner' as const })
        : ({
            kind: 'member' as const,
            role: memberRows?.find((m) => m.plan_id === p.id)?.role ?? 'viewer',
            syncTransactions: memberRows?.find((m) => m.plan_id === p.id)?.sync_transactions ?? false,
          }),
    })),
  })
}

export async function POST(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(json)
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

  const name = parsed.data.name?.trim() || 'Shared Budget'

  const { data: plan, error: pe } = await supabase
    .from('shared_budget_plans')
    .insert({ name, owner_id: user.id })
    .select('id, name, owner_id, created_at, updated_at')
    .single()

  if (pe || !plan) {
    console.error('[budget/plans POST plan]', pe?.message)
    return NextResponse.json({ error: 'Could not create plan' }, { status: 500 })
  }

  const { error: me } = await supabase.from('shared_budget_members').insert({
    plan_id: plan.id,
    user_id: user.id,
    invited_by: user.id,
    role: 'owner',
    status: 'accepted',
    sync_transactions: false,
    accepted_at: new Date().toISOString(),
  })

  if (me) {
    console.error('[budget/plans POST member]', me.message)
    return NextResponse.json({ error: 'Could not create membership' }, { status: 500 })
  }

  const { error: de } = await supabase.from('shared_budget_data').insert({
    plan_id: plan.id,
    payload: {},
    updated_by: user.id,
  })

  if (de) {
    console.error('[budget/plans POST data]', de.message)
    return NextResponse.json({ error: 'Could not create plan data' }, { status: 500 })
  }

  return NextResponse.json({ plan: { ...plan, membership: { kind: 'owner' as const } } })
}
