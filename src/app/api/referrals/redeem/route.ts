import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveActiveApiIdentity } from '@/lib/auth/resolveApiUser'
import { mailboxKeyArgs } from '@/lib/billing/mailboxKey'
import { normalizeEmailKey } from '@/lib/entitlements/trial'
import { isDisposableEmail } from '@/lib/referrals/disposable'
import { clientIp } from '@/lib/server/clientIp'
import { isRateLimited } from '@/lib/server/rateLimit'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store' }
const bodySchema = z.object({ code: z.string().max(64), deviceId: z.string().max(200).nullish() })
const reply = (status: string) => NextResponse.json({ status }, { headers: noStore })

/**
 * Redeems an invite code for the signed-in new account (docs/launch/INVITE_ANTI_ABUSE.md). The server supplies what the
 * client cannot be trusted with: the verified mailbox (one invite per person, ever), the caller's address (rate limit and
 * review signals) and the rate limits. A 429 or 503 leaves the remembered code for the app to retry.
 */
export async function POST(request: Request) {
  const identity = await resolveActiveApiIdentity(request)
  if (!identity) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const service = createServiceRoleClient()
  const ip = clientIp(request)
  if (
    (await isRateLimited(service, `referral-redeem:${identity.id}`, 600, 20)) ||
    (ip !== 'unknown' && (await isRateLimited(service, `referral-redeem-ip:${ip}`, 3600, 300)))
  ) {
    return NextResponse.json({ error: 'Too many requests, try again later' }, { status: 429, headers: noStore })
  }

  const { data: found } = await service.auth.admin.getUserById(identity.id)
  const user = found?.user
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const emailKey = user.email && user.email_confirmed_at && !user.is_anonymous ? normalizeEmailKey(user.email) : null
  if (!emailKey) return reply('unverified')
  if (isDisposableEmail(emailKey)) return reply('disposable_email')

  const mailbox = mailboxKeyArgs(emailKey)
  const { data, error } = await service.rpc('referral_redeem', {
    p_user: identity.id,
    p_code: parsed.data.code,
    p_device_id: parsed.data.deviceId ?? undefined,
    p_mailbox_key: mailbox.key,
    p_legacy_key: mailbox.legacy,
    p_ip: ip === 'unknown' ? undefined : ip,
  })
  if (error || !data) {
    console.error('[referrals/redeem] failed', error?.message)
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: noStore })
  }
  return NextResponse.json(data, { headers: noStore })
}
