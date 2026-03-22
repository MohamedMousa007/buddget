import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { verifyAdminPin } from '@/lib/server/adminAuth'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const denied = verifyAdminPin(body?.pin)
    if (denied) return denied

    const admin = createServiceRoleClient()
    const perPage = Math.min(Number(body?.perPage) || 100, 500)
    const page = Math.max(Number(body?.page) || 1, 1)

    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const users =
      data.users?.map((u: User) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        onboarding_completed: u.user_metadata?.onboarding_completed === true,
      })) ?? []

    return NextResponse.json({
      users,
      total: users.length,
      page,
      perPage,
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
