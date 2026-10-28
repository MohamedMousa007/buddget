import { NextResponse } from 'next/server'
import { recordSuppressions, suppressionFor } from '@/lib/server/email/suppression'
import { verifySignedWebhook } from '@/lib/server/email/webhook'
import { createServiceRoleClient } from '@/lib/supabase/service'

const EVENT_STATUS: Record<string, 'delivered' | 'bounced' | 'complained' | 'failed'> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
}

/** Resend delivery events. Updates the send log by provider id; anything we did not send is acknowledged and ignored. */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!secret) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  const body = await req.text()
  const ok = verifySignedWebhook(
    { id: req.headers.get('svix-id'), timestamp: req.headers.get('svix-timestamp'), signature: req.headers.get('svix-signature') },
    body,
    secret,
  )
  if (!ok) return NextResponse.json({ error: 'Bad signature' }, { status: 401 })

  let event: { type?: string; data?: { email_id?: string; to?: string[]; bounce?: { message?: string; type?: string }; reason?: string } }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 })
  }
  const status = event.type ? EVENT_STATUS[event.type] : undefined
  const id = event.data?.email_id
  if (!status || !id) return NextResponse.json({ ok: true })

  const detail = (event.data?.bounce?.message ?? event.data?.reason ?? '').replace(/\s+/g, ' ').slice(0, 300) || null
  const service = createServiceRoleClient()
  let q = service.from('email_log').update({ status, ...(status === 'delivered' ? {} : { error: detail }) }).eq('provider_message_id', id)
  // A late "delivered" must not overwrite a bounce or complaint that already arrived.
  if (status === 'delivered') q = q.in('status', ['queued', 'sent'])
  const { error } = await q
  if (error) {
    console.error('[webhooks/resend] update failed', error.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
  if (!(await recordSuppressions(service, suppressionFor(event.type, event.data)))) return NextResponse.json({ error: 'Suppression failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
