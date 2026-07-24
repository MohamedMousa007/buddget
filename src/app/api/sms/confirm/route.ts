/**
 * POST /api/sms/confirm
 *
 * Promotes a sms_parse_log row (awaiting_confirmation = true) to an expense or income.
 * Called when the user confirms an item in the dashboard SmsReviewSheet or
 * taps a `sms_confirm` FCM push notification.
 *
 * Auth: Supabase session cookie (web) or Bearer JWT (native via apiFetchAuth).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import type { SmsExpenseKind } from '@/lib/sms/createSmsExpense'
import { createSmsTransaction } from '@/lib/sms/dispatch'
import { DEFAULT_MARKET_RATES } from '@/lib/store/defaultFinanceData'
import { effectiveSender } from '@/lib/sms/routingKey'

const bodySchema = z
  .object({
    logId: z.string().uuid().optional(),
    hash: z.string().min(1).optional(),
    // Optional currency confirmation/correction for `currency_provisional` rows.
    currency: z.string().min(1).max(8).optional(),
  })
  .refine((d) => !!d.logId || !!d.hash, { message: 'Provide logId or hash' })

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
    .select('id, kind, clean_title, merchant_normalized, merchant, bank_name, amount, currency, category, raw_sms_summary, source, raw_body, received_at, account_last4, counterparty_last4, sender, expense_id, income_id, failure_code')
    .eq('user_id', userId)
    .eq('awaiting_confirmation', true)
    .eq('parsed_ok', true)

  if (parsed.data.logId) {
    query = query.eq('id', parsed.data.logId)
  } else {
    query = query.eq('sms_hash', parsed.data.hash!)
  }

  const { data: row } = await query.maybeSingle()

  if (!row) {
    return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
  }

  const senderKey = effectiveSender(row.sender, row.raw_body ?? '', row.bank_name)

  // CURRENCY CONFIRMATION path: the row was already auto-added (provisional
  // currency). Update the existing record in place + learn the (user,sender)
  // currency — NEVER create a second row.
  if (row.expense_id || row.income_id) {
    const confirmedCurrency = parsed.data.currency ?? row.currency
    if (confirmedCurrency) {
      if (row.expense_id) {
        await service.from('expenses').update({ currency: confirmedCurrency }).eq('id', row.expense_id).eq('user_id', userId)
      }
      if (row.income_id) {
        await service.from('income_events').update({ currency: confirmedCurrency }).eq('id', row.income_id).eq('user_id', userId)
      }
      if (senderKey) {
        await service.rpc('learn_sms_sender_currency', {
          p_user: userId, p_sender: senderKey, p_currency: confirmedCurrency, p_confirmed: true,
        })
      }
    }
    await service
      .from('sms_parse_log')
      .update({ awaiting_confirmation: false, status: 'confirmed', failure_code: null, currency: confirmedCurrency })
      .eq('id', row.id)
    return NextResponse.json({
      ok: true,
      currencyConfirmed: true,
      expenseId: row.expense_id,
      incomeId: row.income_id,
      currency: confirmedCurrency,
    })
  }

  const receivedAtIso = new Date(row.received_at ?? Date.now()).toISOString()
  const day = receivedAtIso.slice(0, 10)

  // Re-run the full classifier so a user-confirmed row gets the same
  // transfer/CC/subscription/salary handling as the auto path.
  const tx = await createSmsTransaction(service, {
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
    source: row.source ?? 'sms',
    rawBody: row.raw_body ?? '',
    sender: row.sender ?? null,
    last4: row.account_last4 ?? null,
    counterpartyLast4: row.counterparty_last4 ?? null,
    receivedAtIso,
    logId: row.id,
  }, { exchangeRates: DEFAULT_MARKET_RATES, userConfirmed: true })

  const { expenseId, incomeId, debtPaymentId } = tx
  const postedSomething = !!(expenseId || incomeId || debtPaymentId)
  const intentionalNoPost = tx.outcome === 'income_matched' || tx.outcome === 'transfer_paired'

  // Insert failed — leave the row recoverable (add_failed, still awaiting) and
  // surface the failure rather than swallowing it.
  if (tx.error || (!postedSomething && !intentionalNoPost)) {
    console.error('[sms/confirm] insert failed', tx.error)
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
      category: tx.category ?? row.category,
      // Applied kind, like the category — sms_try_pair matches siblings on it, so a
      // confirmed leg must carry its reclassified kind to stay pairable.
      kind: tx.kind ?? row.kind,
      expense_id: expenseId,
      income_id: incomeId,
      debt_payment_id: debtPaymentId,
    })
    .eq('id', row.id)

  return NextResponse.json({
    ok: true,
    expenseId,
    incomeId,
    isIncome: incomeId !== null,
  })
}
