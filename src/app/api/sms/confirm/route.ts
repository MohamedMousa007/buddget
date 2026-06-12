/**
 * POST /api/sms/confirm
 *
 * Promotes a sms_parse_log row (awaiting_confirmation = true) to an expense or income.
 * Called when the user taps "Add Expense" on the SmsPendingConfirmationsBanner or
 * taps a `sms_confirm` FCM push notification.
 *
 * Auth: Supabase session cookie (credentials: 'include') or Bearer JWT.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import { createSmsExpense, type SmsExpenseKind } from '@/lib/sms/createSmsExpense'

const bodySchema = z.union([
  z.object({ logId: z.string().uuid() }),
  z.object({ hash: z.string().min(1) }),
])

export async function POST(request: Request) {
  const userId = await resolveApiUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let json: unknown
  try { json = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Provide logId or hash' }, { status: 400 })
  }

  const service = createServiceRoleClient()

  // Fetch the pending row
  let query = service
    .from('sms_parse_log')
    .select('id, kind, clean_title, merchant_normalized, merchant, bank_name, amount, currency, category, raw_sms_summary, source, raw_body, received_at')
    .eq('user_id', userId)
    .eq('awaiting_confirmation', true)
    .eq('parsed_ok', true)

  if ('logId' in parsed.data) {
    query = query.eq('id', parsed.data.logId)
  } else {
    query = query.eq('sms_hash', parsed.data.hash)
  }

  const { data: row } = await query.maybeSingle()

  if (!row) {
    return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
  }

  const day = new Date(row.received_at ?? Date.now()).toISOString().slice(0, 10)

  const { expenseId, incomeId, error } = await createSmsExpense(service, {
    userId,
    amount: row.amount!,
    currency: row.currency!,
    day,
    kind: (row.kind ?? null) as SmsExpenseKind,
    cleanTitle: row.clean_title ?? null,
    merchantNormalized: row.merchant_normalized ?? null,
    merchant: row.merchant ?? null,
    bankName: row.bank_name ?? null,
    categoryHint: row.category ?? null,
    rawSmsSummary: row.raw_sms_summary ?? null,
    source: row.source ?? 'sms',
    rawBody: row.raw_body ?? '',
  })

  // Insert failed — leave the row recoverable (add_failed, still awaiting) and
  // surface the failure rather than swallowing it.
  if (error || (!expenseId && !incomeId)) {
    console.error('[sms/confirm] insert failed', error)
    await service
      .from('sms_parse_log')
      .update({ status: 'add_failed', failure_code: 'insert_failed' })
      .eq('id', row.id)
    return NextResponse.json({ ok: false, reason: 'insert_failed' }, { status: 500 })
  }

  // Manually rescued by the user — mark 'tapped' (a warning state in admin) so
  // the tech team can see auto-add needed human intervention.
  await service
    .from('sms_parse_log')
    .update({
      awaiting_confirmation: false,
      status: 'tapped',
      failure_code: null,
      expense_id: expenseId,
      income_id: incomeId,
    })
    .eq('id', row.id)

  return NextResponse.json({
    ok: true,
    expenseId,
    incomeId,
    isIncome: incomeId !== null,
  })
}
