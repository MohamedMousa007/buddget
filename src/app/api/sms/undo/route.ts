/**
 * POST /api/sms/undo
 *
 * Deletes the auto-created expense linked to an SMS event within the 5-minute
 * undo window. Accepts both session-cookie auth (from the notification action
 * opened in-app) and bearer-token auth (from the service worker fetch).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  smsEventId: z.string().uuid(),
})

export async function POST(request: Request) {
  // ── Resolve user_id from session OR bearer token ─────────────────────────
  let userId: string | null = null

  const authHeader = request.headers.get('Authorization') ?? ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const serviceClient = createServiceRoleClient()

  if (bearerToken) {
    // Bearer token path (service worker fetch from notificationclick).
    const { data: tokenRow } = await serviceClient
      .from('sms_ingest_tokens')
      .select('user_id')
      .eq('token', bearerToken)
      .eq('is_active', true)
      .single()
    userId = tokenRow?.user_id ?? null
  } else {
    // Session cookie path (in-app undo button).
    const sessionClient = await createClient()
    const { data: { user } } = await sessionClient.auth.getUser()
    userId = user?.id ?? null
  }

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { smsEventId } = parsed.data

  // ── Fetch the SMS event ──────────────────────────────────────────────────
  const { data: event, error: fetchError } = await serviceClient
    .from('sms_events')
    .select('user_id, expense_id, undo_expires_at')
    .eq('id', smsEventId)
    .single()

  if (fetchError || !event) {
    return NextResponse.json({ error: 'SMS event not found' }, { status: 404 })
  }

  if (event.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Check undo window ────────────────────────────────────────────────────
  if (!event.undo_expires_at || new Date(event.undo_expires_at) < new Date()) {
    return NextResponse.json({ ok: false, expired: true })
  }

  if (!event.expense_id) {
    // Already undone or never had an expense (informational transaction).
    return NextResponse.json({ ok: true, alreadyUndone: true })
  }

  // ── Delete the expense ───────────────────────────────────────────────────
  const { error: deleteError } = await serviceClient
    .from('expenses')
    .delete()
    .eq('id', event.expense_id)
    .eq('user_id', userId)

  if (deleteError) {
    console.error('[sms/undo] expense delete error', deleteError.message)
    return NextResponse.json({ error: 'Failed to undo expense' }, { status: 500 })
  }

  // ── Clear the event linkup and expire undo window ────────────────────────
  await serviceClient
    .from('sms_events')
    .update({ expense_id: null, undo_expires_at: null })
    .eq('id', smsEventId)

  return NextResponse.json({ ok: true, expired: false })
}
