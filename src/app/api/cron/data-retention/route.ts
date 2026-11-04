/**
 * GET /api/cron/data-retention  (Vercel Cron, daily)
 *
 * Erases addresses Buddget has no account to attach them to: `email_log` rows with no user (admin invitations to
 * people who never signed up, and rows whose account was deleted) lose `to_email` after RETENTION_DAYS. The row stays
 * as a delivery record; only the address goes. Counts only in the response.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/server/cronAuth'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const maxDuration = 60

const EMAIL_LOG_RETENTION_DAYS = 90
const ERASED_ADDRESS = '[erased]'

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceRoleClient()
  const cutoff = new Date(Date.now() - EMAIL_LOG_RETENTION_DAYS * 24 * 3600_000).toISOString()
  const { data, error } = await service
    .from('email_log')
    .update({ to_email: ERASED_ADDRESS })
    .is('user_id', null)
    .lt('created_at', cutoff)
    .neq('to_email', ERASED_ADDRESS)
    .select('id')
  if (error) {
    console.error('[cron/data-retention] email_log failed', error.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  return NextResponse.json({ ok: true, emailLogErased: data?.length ?? 0 })
}
