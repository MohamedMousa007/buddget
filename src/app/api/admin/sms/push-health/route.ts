import { getFirebaseAdmin } from '@/lib/server/firebaseAdmin'
import { guardAdmin, json } from '@/lib/server/admin/guard'

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'sms.view' })
  if (!g.ok) return g.res
  const { data } = await g.ctx.service.rpc('admin_push_platform_counts')
  const byPlatform: Record<string, number> = {}
  let tokens = 0
  for (const row of data ?? []) {
    byPlatform[row.platform] = row.n
    tokens += row.n
  }
  return json({ configured: getFirebaseAdmin() !== null, tokens, byPlatform })
}
