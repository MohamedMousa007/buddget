import { NextResponse } from 'next/server'
import { clientIp, rateBucketIp } from '@/lib/server/clientIp'
import { memoryGateOk, tooManyRequests } from '@/lib/server/publicApiRateLimit'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { APP_INVITE_CODE, WAITLIST_SHARE_CODE, firstWord } from '@/lib/site/waitlist'

/**
 * GET /api/site/waitlist/pass?code=… → { name }: the inviter's first name for the guest pass on the waitlist invite page.
 * A waitlist share code reads the optional first name its owner gave; an in-app code uses the app's own lookup
 * (referral_inviter_first_name). Nothing else about the inviter is returned, and an unknown code answers null.
 */
export async function GET(request: Request) {
  const ip = rateBucketIp(clientIp(request))
  if (!memoryGateOk(`site-waitlist-pass:${ip}`, 30, 60)) return tooManyRequests(60)
  const code = (new URL(request.url).searchParams.get('code') ?? '').trim().toUpperCase()
  const headers = { 'Cache-Control': 'public, max-age=300' }
  const share = WAITLIST_SHARE_CODE.test(code)
  if (!share && !APP_INVITE_CODE.test(code)) return NextResponse.json({ name: null }, { headers })

  const service = createServiceRoleClient()
  let name: string | null = null
  if (share) {
    const { data } = await service.from('waitlist_signups').select('name').eq('share_code', code).maybeSingle()
    name = firstWord(data?.name)
  } else {
    const { data } = await service.rpc('referral_inviter_first_name', { p_code: code })
    name = firstWord(typeof data === 'string' ? data : null)
  }
  return NextResponse.json({ name }, { headers })
}
