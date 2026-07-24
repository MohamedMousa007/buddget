/**
 * POST /api/sms/undo
 *
 * Deletes the auto-created expense/income linked to an SMS parse-log row. Accepts
 * both session-cookie auth (from the notification action opened in-app) and
 * bearer-token auth (from the service worker fetch).
 *
 * Only the funnel's `sms_parse_log` rows exist — the legacy `sms_events` ingest
 * path was removed, so `parseLogId` is the sole input.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  parseLogId: z.string().uuid(),
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

  const { parseLogId } = parsed.data

  // Direct "delete the linked entry" shortcut — no time window (the user can
  // delete from the ledger anyway). Handles both expense and income links.
  const { data: logRow, error: logErr } = await serviceClient
    .from('sms_parse_log')
    .select('user_id, expense_id, income_id')
    .eq('id', parseLogId)
    .single()

  if (logErr || !logRow) {
    return NextResponse.json({ error: 'Parse log not found' }, { status: 404 })
  }
  if (logRow.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!logRow.expense_id && !logRow.income_id) {
    return NextResponse.json({ ok: true, alreadyUndone: true })
  }

  if (logRow.expense_id) {
    const { error: delErr } = await serviceClient
      .from('expenses')
      .delete()
      .eq('id', logRow.expense_id)
      .eq('user_id', userId)
    if (delErr) {
      console.error('[sms/undo] expense delete error', delErr.message)
      return NextResponse.json({ error: 'Failed to undo expense' }, { status: 500 })
    }
  }
  if (logRow.income_id) {
    const { error: incErr } = await serviceClient
      .from('income_events')
      .delete()
      .eq('id', logRow.income_id)
      .eq('user_id', userId)
    if (incErr) {
      console.error('[sms/undo] income delete error', incErr.message)
      return NextResponse.json({ error: 'Failed to undo income' }, { status: 500 })
    }
  }

  await serviceClient
    .from('sms_parse_log')
    .update({ expense_id: null, income_id: null })
    .eq('id', parseLogId)

  return NextResponse.json({ ok: true, expired: false })
}
