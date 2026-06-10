import { NextResponse } from 'next/server'
import { verifyAdminPin } from '@/lib/server/adminAuth'
import { sendNativePush } from '@/lib/server/sendNativePush'
import { createServiceRoleClient } from '@/lib/supabase/service'

export async function POST(req: Request) {
  const pin = req.headers.get('x-admin-pin') ?? ''
  const authError = verifyAdminPin(pin, req)
  if (authError) return authError

  const service = createServiceRoleClient()
  const { data: tokens } = await service
    .from('push_tokens')
    .select('user_id, platform, updated_at')
    .limit(10)

  if (!tokens || tokens.length === 0) {
    return NextResponse.json({
      error: 'No push tokens registered — open the app on your device first',
      tokenCount: 0,
    }, { status: 404 })
  }

  const userId = tokens[0]!.user_id
  const result = await sendNativePush({
    userId,
    title: 'FCM Test',
    body: 'Push delivery is working ✓',
    data: { type: 'test' },
  })

  return NextResponse.json({
    ...result,
    tokenCount: tokens.length,
    tokens: tokens.map((t) => ({ platform: t.platform, updatedAt: t.updated_at })),
  })
}
