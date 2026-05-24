/**
 * POST /api/push/send
 *
 * Server-side fan-out to a user's registered FCM/APNS tokens. Internal-only:
 * call from cron jobs / other route handlers via service-role context. Never
 * exposes a public user-targetable surface — caller must be authenticated.
 *
 * Body shape:
 * {
 *   userId: string,            // recipient
 *   title: string,
 *   body: string,
 *   data?: Record<string, string>,
 *   collapseKey?: string,
 * }
 *
 * Currently allows the recipient to send to themselves (test push from the
 * Settings page). Privileged senders should call the helper directly.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sendNativePush } from '@/lib/server/sendNativePush'

const bodySchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  data: z.record(z.string(), z.string()).optional(),
  collapseKey: z.string().max(120).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  // Self-targeted only via this public endpoint. Cross-user push goes through
  // the server helper directly (e.g. SMS auto-detect → /api/sms/parse).
  if (parsed.data.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await sendNativePush(parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }
  return NextResponse.json({ ok: true, sent: result.sent, failed: result.failed })
}
