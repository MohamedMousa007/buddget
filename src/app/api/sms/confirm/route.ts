/**
 * POST /api/sms/confirm
 *
 * Promotes a sms_parse_log row (awaiting_confirmation = true) to an expense or income.
 * Called when the user confirms an item in the dashboard SmsReviewSheet or
 * taps a `sms_confirm` FCM push notification.
 *
 * Auth: Supabase session cookie (web) or Bearer JWT (native via apiFetchAuth).
 */
import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { smsLocalDay } from '@/lib/sms/ingestGuards'
import { getUserTimeZone } from '@/lib/server/userTimeZone'
import { z } from 'zod'
import { smsDeviceGate } from '@/lib/sms/deviceGate'
import { DEVICE_ID_HEADER } from '@/lib/auth/deviceIdConstants'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { Constants } from '@/lib/supabase/database.types'
import { resolveApiUserId } from '@/lib/auth/resolveApiUser'
import type { SmsExpenseKind } from '@/lib/sms/createSmsExpense'
import { createSmsTransaction } from '@/lib/sms/dispatch'
import { isIncomeKind } from '@/lib/sms/createSmsExpense'
import { DEFAULT_MARKET_RATES } from '@/lib/store/defaultFinanceData'
import { effectiveSender } from '@/lib/sms/routingKey'
import type { Currency } from '@/lib/store/types'

const bodySchema = z
  .object({
    logId: z.string().uuid().optional(),
    hash: z.string().min(1).optional(),
    // Optional currency confirmation/correction for `currency_provisional` rows.
    currency: z.enum(Constants.public.Enums.currency_code).optional(),
  })
  .refine((d) => !!d.logId || !!d.hash, { message: 'Provide logId or hash' })

const ROW_COLUMNS =
  'id, kind, clean_title, merchant_normalized, merchant, bank_name, amount, currency, category, raw_sms_summary, source, raw_body, received_at, account_last4, counterparty_last4, sender, expense_id, income_id, failure_code, matched_template_id'

export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const userId = await resolveApiUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceRoleClient()
  const blocked = await smsDeviceGate(service, {
    userId,
    deviceId: request.headers.get(DEVICE_ID_HEADER)?.trim() || null,
    viaJwt: (request.headers.get('authorization') ?? '').startsWith('Bearer '),
  })
  if (blocked) return blocked

  let json: unknown
  try { json = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Provide logId or hash' }, { status: 400 })
  }

  // Claim the row atomically: only one concurrent confirm (push tap + sheet, double tap) gets it.
  let claim = service
    .from('sms_parse_log')
    .update({ awaiting_confirmation: false })
    .eq('user_id', userId)
    .eq('awaiting_confirmation', true)
    .eq('parsed_ok', true)

  claim = parsed.data.logId
    ? claim.eq('id', parsed.data.logId)
    : claim.eq('sms_hash', parsed.data.hash as string).eq('is_duplicate', false)

  const { data: row } = await claim.select(ROW_COLUMNS).maybeSingle()

  if (!row) {
    return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
  }

  const release = (failure: { status: string; failure_code: string }) =>
    service.from('sms_parse_log').update({ awaiting_confirmation: true, ...failure }).eq('id', row.id)
  const fail = async (reason: string, status: number) => {
    await release({ status: 'add_failed', failure_code: reason })
    return NextResponse.json({ ok: false, reason }, { status })
  }

  const senderKey = effectiveSender(row.sender, row.raw_body ?? '', row.bank_name)

  let posted = false
  try {
    // CURRENCY CONFIRMATION path: the row was already auto-added (provisional
    // currency). Update the existing record in place + learn the (user,sender)
    // currency — NEVER create a second row.
    if (row.expense_id || row.income_id) {
      const confirmedCurrency = (parsed.data.currency ?? row.currency) as Currency | null
      if (confirmedCurrency) {
        if (row.expense_id) {
          const { error } = await service.from('expenses').update({ currency: confirmedCurrency }).eq('id', row.expense_id).eq('user_id', userId)
          if (error) { console.error('[sms/confirm] expense currency update failed', error); return fail('currency_update_failed', 500) }
        }
        if (row.income_id) {
          const { error } = await service.from('income_events').update({ currency: confirmedCurrency }).eq('id', row.income_id).eq('user_id', userId)
          if (error) { console.error('[sms/confirm] income currency update failed', error); return fail('currency_update_failed', 500) }
        }
        if (senderKey) {
          const { error } = await service.rpc('learn_sms_sender_currency', {
            p_user: userId, p_sender: senderKey, p_currency: confirmedCurrency, p_confirmed: true,
          })
          if (error) console.error('[sms/confirm] learn currency failed', error)
        }
      }
      const { error: logErr } = await service
        .from('sms_parse_log')
        .update({ status: 'confirmed', failure_code: null, currency: confirmedCurrency })
        .eq('id', row.id)
      if (logErr) { console.error('[sms/confirm] log update failed', logErr); return fail('log_update_failed', 500) }
      return NextResponse.json({
        ok: true,
        currencyConfirmed: true,
        expenseId: row.expense_id,
        incomeId: row.income_id,
        currency: confirmedCurrency,
      })
    }

    if (row.amount == null || !row.currency) return fail('invalid_row', 422)

    // Salary matching, transfer pairing and debt picking read the SMS text. Once retention has removed it, booking
    // would silently degrade (wrong category, no counterparty), so say so instead.
    const kind = (row.kind ?? null) as SmsExpenseKind
    if (row.raw_body == null && (isIncomeKind(kind) || kind === 'own_transfer' || kind === 'cc_payoff' || kind === 'installment_payment')) {
      return fail('raw_purged', 410)
    }

    const receivedAtIso = new Date(row.received_at ?? Date.now()).toISOString()
    const day = smsLocalDay(receivedAtIso, await getUserTimeZone(service, userId))

    // Re-run the full classifier so a user-confirmed row gets the same
    // transfer/CC/subscription/salary handling as the auto path.
    const tx = await createSmsTransaction(service, {
      userId,
      amount: row.amount,
      currency: row.currency,
      day,
      kind,
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
      // Carried so the direction-guard oracle can attribute a wrong `kind` back to the template
      // that produced it on this path too — a defect is no less real for being user-confirmed.
      matchedTemplateId: row.matched_template_id ?? null,
    }, { exchangeRates: DEFAULT_MARKET_RATES, userConfirmed: true })

    const { expenseId, incomeId, debtPaymentId } = tx
    const postedSomething = !!(expenseId || incomeId || debtPaymentId)
    posted = postedSomething
    const intentionalNoPost = tx.outcome === 'transfer_paired'

    // Insert failed — leave the row recoverable (add_failed, still awaiting) and
    // surface the failure rather than swallowing it.
    if (tx.error || (!postedSomething && !intentionalNoPost)) {
      console.error('[sms/confirm] insert failed', tx.error)
      return fail('insert_failed', 500)
    }

    // Manually rescued by the user — mark 'tapped' (a warning state in admin) so
    // the tech team can see auto-add needed human intervention.
    const { error: finalErr } = await service
      .from('sms_parse_log')
      .update({
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
    // The transaction is already posted; the claim stays released so a retry cannot post it twice.
    if (finalErr) console.error('[sms/confirm] log link update failed', finalErr)

    return NextResponse.json({
      ok: true,
      expenseId,
      incomeId,
      isIncome: incomeId !== null,
    })
  } catch (e) {
    console.error('[sms/confirm] unhandled exception', e)
    // Once posted, releasing the claim would let a retry post it a second time.
    if (posted) return NextResponse.json({ ok: false, reason: 'confirm_exception' }, { status: 500 })
    return fail('confirm_exception', 500)
  }
}
