import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  defaultBudgetPlanId: z.string().uuid().nullable(),
})

/**
 * PATCH /api/budget/profile-default — set `user_profiles.default_budget_plan_id`.
 */
export async function PATCH(request: Request) {
  let json: unknown
  try {
    json = await request.json()
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
  if (planId) {
    const { data: owned } = await supabase
      .from('shared_budget_plans')
      .select('id')
      .eq('id', planId)
      .eq('owner_id', user.id)
      .maybeSingle()

    const { data: memberRow } = await supabase
      .from('shared_budget_members')
      .select('id')
      .eq('plan_id', planId)
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .maybeSingle()

    if (!owned && !memberRow) {
      return NextResponse.json({ error: 'Plan not accessible' }, { status: 403 })
    }
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      default_budget_plan_id: planId,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) {
    console.error('[profile-default]', error.message)
    return NextResponse.json({ error: 'Could not save default' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
