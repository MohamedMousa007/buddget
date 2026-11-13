/**
 * GET /api/cron/sms-canary  (Vercel Cron, daily)
 *
 * Probes the path phones use to deliver SMS (CORS preflight, auth gate, and an end-to-end ingest when SMS_CANARY_TOKEN is
 * set) and stores the verdict where the admin SMS health tab reads it. A failing or missing verdict is shown there.
 *
 * Auth: `Authorization: Bearer ${CRON_SECRET}`.
 */
import { NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/server/cronAuth'
import { runCanary } from '@/lib/sms/canary'
import { createServiceRoleClient } from '@/lib/supabase/service'

export const maxDuration = 60

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceRoleClient()
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || new URL(request.url).origin
  const token = process.env.SMS_CANARY_TOKEN?.trim() || undefined
  const result = await runCanary({
    base,
    token,
    consumeRow: async (smsHash) => {
      const { data } = await service.from('sms_parse_log').delete().eq('sms_hash', smsHash).select('id')
      return (data ?? []).length > 0
    },
  })
  if (!result.ok) console.error('[sms-canary] failing', JSON.stringify(result.checks.filter((c) => !c.ok)))
  const { error } = await service.from('platform_settings').upsert({ key: 'sms_canary', value: JSON.parse(JSON.stringify(result)) }, { onConflict: 'key' })
  if (error) console.error('[sms-canary] could not store the verdict', error.message)
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
