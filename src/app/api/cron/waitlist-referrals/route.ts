/**
 * GET /api/cron/waitlist-referrals  (Vercel Cron, daily, before /api/cron/loyalty)
 *
 * Turns waitlist invites into the app's real invites (migration 0369). For each waitlist row whose invitee now has a
 * confirmed account under the same email, it records the in-app referral through referral_redeem with p_waitlist, so
 * every invite rule applies unchanged (one per person and mailbox, no self or same-device invites, rewards only after the
 * friend activates on a phone, caps). The mailbox key needs the server secret, which is why this runs here and not in SQL.
 * Settled rows get referral_status; transient answers (disabled, a database error) leave the row for the next run.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server'
import { mailboxKeyArgs } from '@/lib/billing/mailboxKey'
import { normalizeEmailKey } from '@/lib/entitlements/trial'
import { isDisposableEmail } from '@/lib/referrals/disposable'
import { isAuthorizedCron } from '@/lib/server/cronAuth'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const maxDuration = 60

const BATCH = 200
const BUDGET_MS = 40_000
/** Answers that will not change on a later run. Anything else (disabled, errors) is retried. */
const FINAL = new Set(['ok', 'already_redeemed', 'self_invite', 'device_used', 'invalid_code', 'not_waitlisted', 'account_too_old', 'disposable_email', 'invalid_email'])

type Candidate = { waitlist_id: string; invitee_id: string; invitee_email: string; inviter_id: string; inviter_code: string | null }
type Service = ReturnType<typeof createServiceRoleClient>

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const started = Date.now()
  const service = createServiceRoleClient()
  const { data: rows, error } = await service.rpc('waitlist_referral_candidates', { p_limit: BATCH })
  if (error) {
    console.error('[cron/waitlist-referrals] candidates failed', error.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  const counts: Record<string, number> = {}
  for (const row of (rows ?? []) as Candidate[]) {
    if (Date.now() - started > BUDGET_MS) break
    const status = await settle(service, row)
    counts[status] = (counts[status] ?? 0) + 1
    if (FINAL.has(status)) {
      await service.from('waitlist_signups').update({ referral_status: status, referral_checked_at: new Date().toISOString() }).eq('id', row.waitlist_id)
    }
  }
  return NextResponse.json({ ok: true, candidates: rows?.length ?? 0, counts })
}

async function settle(service: Service, row: Candidate): Promise<string> {
  const emailKey = normalizeEmailKey(row.invitee_email)
  if (!emailKey) return 'invalid_email'
  if (isDisposableEmail(emailKey)) return 'disposable_email'
  let code = row.inviter_code
  if (!code) {
    const made = await service.rpc('referral_ensure_code', { p_user: row.inviter_id })
    if (made.error || !made.data) return 'error'
    code = made.data
  }
  const mailbox = mailboxKeyArgs(emailKey)
  const { data, error } = await service.rpc('referral_redeem', {
    p_user: row.invitee_id, p_code: code, p_mailbox_key: mailbox.key, p_legacy_key: mailbox.legacy, p_waitlist: true,
  })
  if (error || !data) {
    console.error('[cron/waitlist-referrals] redeem failed', error?.code)
    return 'error'
  }
  return String((data as { status?: string }).status ?? 'error')
}
