/**
 * POST /api/sms/undo
 *
 * Retires the auto-created expense/income/debt payment linked to an SMS parse-log row, as
 * soft-deletes so sync tombstones reach every device. Auth: Bearer (Supabase JWT or SMS ingest
 * token, same resolver as sms/ack) or the session cookie (web).
 *
 * Only the funnel's `sms_parse_log` rows exist, so `parseLogId` is the sole input.
 */

import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveActiveApiUserId } from '@/lib/auth/resolveApiUser'
import { resolveSmsCaller } from '@/lib/sms/resolveSmsUser'
import { smsDeviceGate } from '@/lib/sms/deviceGate'

const bodySchema = z.object({
  parseLogId: z.string().uuid(),
})

export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const serviceClient = createServiceRoleClient()
  const hasBearer = (request.headers.get('authorization') ?? '').startsWith('Bearer ')
  const caller = hasBearer
    ? await resolveSmsCaller(request)
    : { userId: await resolveActiveApiUserId(request), deviceId: null, viaJwt: false }
  const { userId } = caller

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const blocked = await smsDeviceGate(serviceClient, caller)
  if (blocked) return blocked

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

  const { data: logRow, error: logErr } = await serviceClient
    .from('sms_parse_log')
    .select('user_id, expense_id, income_id, debt_payment_id')
    .eq('id', parseLogId)
    .single()

  if (logErr || !logRow) {
    return NextResponse.json({ error: 'Parse log not found' }, { status: 404 })
  }
  if (logRow.user_id !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!logRow.expense_id && !logRow.income_id && !logRow.debt_payment_id) {
    return NextResponse.json({ ok: true, alreadyUndone: true })
  }

  const deletedAt = new Date().toISOString()
  const targets = [
    { table: 'expenses', id: logRow.expense_id, label: 'expense' },
    { table: 'income_events', id: logRow.income_id, label: 'income' },
    { table: 'debt_payments', id: logRow.debt_payment_id, label: 'debt payment' },
  ] as const
  for (const { table, id, label } of targets) {
    if (!id) continue
    // A refund/declined/twin log points at the ORIGINAL purchase (expense_id): only rows this log created are retired.
    let retire = serviceClient.from(table).update({ deleted_at: deletedAt }).eq('id', id).eq('user_id', userId)
    if (table !== 'debt_payments') retire = retire.eq('sms_log_id', parseLogId)
    const { error } = await retire
    if (error) {
      console.error(`[sms/undo] ${label} delete error`, error.message)
      return NextResponse.json({ error: `Failed to undo ${label}` }, { status: 500 })
    }
  }

  // A refund/decline matched onto an earlier purchase marked it: undoing the SMS clears that mark.
  const { error: unmarkErr } = await serviceClient
    .from('expenses')
    .update({ refunded_at: null, refund_kind: null, refund_sms_log_id: null })
    .eq('refund_sms_log_id', parseLogId)
    .eq('user_id', userId)
  if (unmarkErr) {
    console.error('[sms/undo] refund unmark error', unmarkErr.message)
    return NextResponse.json({ error: 'Failed to undo refund' }, { status: 500 })
  }

  // A paired sibling still points at this log; leave neither side half-linked.
  const { error: siblingErr } = await serviceClient
    .from('sms_parse_log')
    .update({ paired_log_id: null })
    .eq('paired_log_id', parseLogId)
    .eq('user_id', userId)
  if (siblingErr) {
    console.error('[sms/undo] sibling unpair error', siblingErr.message)
    return NextResponse.json({ error: 'Failed to undo pairing' }, { status: 500 })
  }

  const { error: updErr } = await serviceClient
    .from('sms_parse_log')
    .update({ expense_id: null, income_id: null, debt_payment_id: null, paired_log_id: null })
    .eq('id', parseLogId)
  if (updErr) {
    console.error('[sms/undo] log update error', updErr.message)
    return NextResponse.json({ error: 'Failed to update log' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, expired: false })
}
