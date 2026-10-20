import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { requireAiUser } from '@/lib/server/ai/auth'
import { quotaStoreAvailable } from '@/lib/server/ai/quota'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

/** What the chat's usage wheel shows: the live chat, the rolling windows and today's chats. */
export async function GET(req: Request) {
  const outdated = await gateOutdatedClient(req)
  if (outdated) return outdated
  const auth = await requireAiUser(req)
  if ('denied' in auth) return auth.denied
  if (!quotaStoreAvailable()) return NextResponse.json({ chat: null, windows: {}, chats_today: { used: 0, limit: null, reset_at: null } })
  const { data, error } = await createServiceRoleClient().rpc('ai_quota_status', { p_user: auth.userId })
  if (error || !data) {
    console.error('[buddgy/usage] status failed', error?.message)
    return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
