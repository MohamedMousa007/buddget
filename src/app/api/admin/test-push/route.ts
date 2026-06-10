import { NextResponse } from 'next/server'
import { verifyAdminPin } from '@/lib/server/adminAuth'
import { sendNativePush } from '@/lib/server/sendNativePush'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function POST(req: Request) {
  const pin = req.headers.get('x-admin-pin') ?? ''
  const authError = verifyAdminPin(pin, req)
  if (authError) return authError

  const service = createServiceRoleClient()
  const { data: rows } = await service
    .from('push_tokens')
    .select('user_id')
    .limit(1)
    .single()

  if (!rows?.user_id) {
    return NextResponse.json({ error: 'No push tokens registered' }, { status: 404 })
  }

  const result = await sendNativePush({
    userId: rows.user_id,
    title: 'FCM Test',
    body: 'Push delivery is working ✓',
    data: { type: 'test' },
  })

  return NextResponse.json(result)
}
