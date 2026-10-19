import { getFirebaseAdmin } from '@/lib/server/firebaseAdmin'
import { guardAdmin, json } from '@/lib/server/admin/guard'

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'sms.view' })
  if (!g.ok) return g.res
  const { data } = await g.ctx.service.from('push_tokens').select('platform')
  const byPlatform: Record<string, number> = {}
  for (const row of data ?? []) byPlatform[row.platform ?? 'unknown'] = (byPlatform[row.platform ?? 'unknown'] ?? 0) + 1
  return json({ configured: getFirebaseAdmin() !== null, tokens: data?.length ?? 0, byPlatform })
}
