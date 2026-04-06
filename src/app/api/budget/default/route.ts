import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  /** Shared plan UUID from `shared_budget_plans`, or null for personal-only default. */
  defaultBudgetPlanId: z.string().uuid().nullable(),
})

/**
 * PATCH — set `user_profiles.default_budget_plan_id` (must own or be accepted member).
 */
export async function PATCH(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
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

  const planId = parsed.data.defaultBudgetPlanId
  if (planId === null) {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        default_budget_plan_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) {
      console.error('[budget/default]', error.message)
      return NextResponse.json({ error: 'Could not update' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  const { data: plan } = await supabase
    .from('shared_budget_plans')
    .select('id, owner_id')
    .eq('id', planId)
    .maybeSingle()

  if (!plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  }

  if (plan.owner_id === user.id) {
    const { error } = await supabase
      .from('user_profiles')
      .update({
        default_budget_plan_id: planId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (error) {
      console.error('[budget/default]', error.message)
      return NextResponse.json({ error: 'Could not update' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  const { data: mem } = await supabase
    .from('shared_budget_members')
    .select('id')
    .eq('plan_id', planId)
    .eq('user_id', user.id)
    .eq('status', 'accepted')
    .maybeSingle()

  if (!mem) {
    return NextResponse.json({ error: 'Not a member of this plan' }, { status: 403 })
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      default_budget_plan_id: planId,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) {
    console.error('[budget/default]', error.message)
    return NextResponse.json({ error: 'Could not update' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
