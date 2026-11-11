import { checkReason } from '@/lib/admin/grants'
import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import { AUDIT_REFUSAL } from '@/lib/server/admin/audit'
import { STEP_UP_ERROR, stepUp, type StepUpProof } from '@/lib/server/admin/stepUp'
import { UUID_RE } from '@/lib/server/admin/targets'
import { hasFinancialGrant } from '@/lib/server/admin/financialAccess'
import { exportUserData } from '@/lib/server/userData'

type Params = { params: Promise<{ id: string }> }

const EXPORTS_PER_HOUR = 5
const ROWS_PER_TABLE = 20_000

/**
 * A data-subject access request: everything we hold about one person, as one JSON file. It carries financial
 * content, so it needs `dsr.manage`, a live financial grant for the user (or the owner), a reason and a fresh step-up, and it is audited.
 */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  if (!UUID_RE.test(id)) return bad('Invalid user id.')
  const g = await guardAdmin(req, { permission: 'dsr.manage' })
  if (!g.ok) return g.res
  const { ctx } = g
  const body = await readJson<StepUpProof & { reason?: string; ticket?: number }>(req)
  const why = checkReason(body?.reason)
  if (!why.ok) return bad(why.error)
  if (!(await hasFinancialGrant(ctx, id))) return bad('Open financial access for this user first: an export contains all of it.', 403)
  if (!(await stepUp(ctx, body ?? {}))) return bad(STEP_UP_ERROR, 401)

  const { data: allowed } = await ctx.service.rpc('api_rate_hit', { p_key: `dsr-export:${ctx.staff.id}`, p_window_seconds: 3600, p_max_hits: EXPORTS_PER_HOUR })
  if (allowed === false) return bad('Too many exports this hour.', 429)

  const { data: auth } = await ctx.service.auth.admin.getUserById(id)
  if (!auth.user) return bad('User not found.', 404)

  // The trail comes first: if it cannot be written, nothing is released.
  const audited = await ctx.audit('dsr.export', {
    targetType: 'user',
    targetId: id,
    summary: 'Exported all data held about a user',
    metadata: { reason: why.reason, ticket: body?.ticket ?? null },
  })
  if (audited === false) return bad(AUDIT_REFUSAL, 503)

  const profile = await ctx.service.from('profiles').select('*').eq('id', id).maybeSingle()
  const { tables, failed } = await exportUserData(ctx.service, id, ROWS_PER_TABLE, auth.user.email ?? null)
  return json({
    exportedAt: new Date().toISOString(),
    account: { id, email: auth.user.email ?? null, createdAt: auth.user.created_at },
    profile: profile.data ?? null,
    tables,
    incomplete: failed,
  })
}
