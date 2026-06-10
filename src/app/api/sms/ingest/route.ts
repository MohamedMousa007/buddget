/**
 * POST /api/sms/ingest
 *
 * Receives a raw SMS from an iOS Shortcut or Android Bridge app and, if it
 * matches a known Egyptian bank pattern, automatically creates an expense and
 * dispatches a Web Push notification with Undo/View actions.
 *
 * Auth: Bearer token (from `sms_ingest_tokens`) — no session cookie required
 * because external automation apps cannot maintain one.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { parse } from '@/lib/sms/smsParser'
import { sendWebPush } from '@/lib/notifications/sendWebPush'

const bodySchema = z.object({
  smsBody: z.string().min(1).max(2000),
  senderNumber: z.string().min(1).max(100),
  receivedAt: z.string().datetime({ offset: true }).optional(),
})

export async function POST(request: Request) {
  // ── 1. Bearer token auth ─────────────────────────────────────────────────
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  const { data: tokenRow, error: tokenError } = await supabase
    .from('sms_ingest_tokens')
    .select('id, user_id')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: 'Invalid or inactive token' }, { status: 401 })
  }

  const { id: tokenId, user_id: userId } = tokenRow

  // ── 2. Parse and validate body ───────────────────────────────────────────
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', details: parsed.error.flatten() }, { status: 400 })
  }

  const { smsBody, senderNumber, receivedAt } = parsed.data
  const receivedAtTs = receivedAt ?? new Date().toISOString()

  // ── 3. Parse SMS ─────────────────────────────────────────────────────────
  const parsedTx = parse(smsBody, senderNumber)

  if (!parsedTx) {
    // Log the unparsed event for future rule improvements, then bail.
    await supabase.from('sms_events').insert({
      user_id: userId,
      token_id: tokenId,
      sender: senderNumber,
      raw_body: smsBody,
      received_at: receivedAtTs,
      parsed_at: new Date().toISOString(),
      parse_ok: false,
    })
    return NextResponse.json({ ok: false, reason: 'no_match' })
  }

  // ── 4. Create expense (only for expense-type transactions) ───────────────
  let expenseId: string | null = null

  if (parsedTx.shouldRecord) {
    const description =
      parsedTx.merchant
        ? `${parsedTx.merchant} (via ${parsedTx.bankName})`
        : `${parsedTx.bankName} — ${parsedTx.type.replace(/_/g, ' ')}`

    const { data: expenseRow, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        user_id: userId,
        amount: parsedTx.amount,
        currency: parsedTx.currency as 'EGP' | 'USD' | 'EUR',
        category: parsedTx.autoCategory as 'Other',
        description,
        expense_date: receivedAtTs.slice(0, 10),
        notes: `Auto-tracked from SMS (${parsedTx.bankName})`,
      })
      .select('id')
      .single()

    if (expenseError) {
      console.error('[sms/ingest] expense insert error', expenseError.message)
      return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 })
    }

    expenseId = expenseRow.id
  }

  // ── 6. Log sms_event ────────────────────────────────────────────────────
  const undoExpiresAt = expenseId
    ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
    : null

  const { data: smsEventRow, error: smsError } = await supabase
    .from('sms_events')
    .insert({
      user_id: userId,
      token_id: tokenId,
      sender: senderNumber,
      raw_body: smsBody,
      received_at: receivedAtTs,
      parsed_at: new Date().toISOString(),
      parse_ok: true,
      is_duplicate: false,
      transaction_type: parsedTx.type,
      amount: parsedTx.amount,
      currency: parsedTx.currency,
      merchant: parsedTx.merchant,
      bank_name: parsedTx.bankName,
      badge_key: parsedTx.badgeKey,
      auto_category: parsedTx.autoCategory,
      expense_id: expenseId,
      undo_expires_at: undoExpiresAt,
    })
    .select('id')
    .single()

  if (smsError) {
    console.error('[sms/ingest] sms_events insert error', smsError.message)
    // Don't fail — expense was created; just skip push notification.
    return NextResponse.json({ ok: true, expenseId, smsEventId: null })
  }

  const smsEventId = smsEventRow.id

  // ── 7. Dispatch Web Push notification ────────────────────────────────────
  if (expenseId) {
    const amountFormatted = `${parsedTx.currency} ${parsedTx.amount.toLocaleString()}`
    const title = parsedTx.merchant
      ? `${amountFormatted} at ${parsedTx.merchant}`
      : `${amountFormatted} — ${parsedTx.bankName}`
    const body = `Auto-tracked from ${parsedTx.bankName}. Tap to view or undo.`

    await sendWebPush(userId, supabase, {
      title,
      body,
      smsEventId,
      expenseId,
    }).catch((err) => {
      // Push failures are non-fatal — the expense is already saved.
      console.warn('[sms/ingest] push send error', err?.message)
    })
  }

  return NextResponse.json({ ok: true, expenseId, smsEventId })
}
