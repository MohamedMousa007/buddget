/**
 * POST /api/sms/own-transfer
 *
 * The user's answer on a bank-message pair that may be a transfer between their own accounts:
 * confirm (an 'ask' pair is booked as one own transfer), decline (an 'ask' pair stays as it is), or
 * undo (a 'settle' pair goes back to spending plus income). One leg whose counterparty digits may be the user's own
 * account ('ask_account') is answered with confirm_account or decline_account, on that one log. Auth and device gate
 * match /api/sms/undo.
 */

import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveActiveApiUserId } from '@/lib/auth/resolveApiUser'
import { resolveSmsCaller } from '@/lib/sms/resolveSmsUser'
import { smsDeviceGate } from '@/lib/sms/deviceGate'
import { rememberOwnAnswer } from '@/lib/sms/pairing'
import { answerOneLegQuestion } from '@/lib/sms/ownAccountAnswer'
import { mapKindToCategory } from '@/lib/sms/createSmsExpense'
import type { Database } from '@/lib/supabase/database.types'
import { nudgeUser } from '@/lib/server/realtime/nudge'

const bodySchema = z.object({
  parseLogId: z.string().uuid(),
  action: z.enum(['confirm', 'decline', 'undo', 'confirm_account', 'decline_account']),
})

const LOG_COLUMNS = 'id, user_id, amount, currency, account_last4, counterparty_last4, bank_name, received_at, raw_body, paired_log_id, own_transfer_verdict, own_transfer_candidate'
const ALLOWED_VERDICT = { confirm: 'ask', decline: 'ask', undo: 'settle', confirm_account: 'ask_account', decline_account: 'ask_account' } as const

type Service = ReturnType<typeof createServiceRoleClient>
interface LogRow {
  id: string
  user_id: string
  amount: number | null
  currency: string | null
  account_last4: string | null
  counterparty_last4: string | null
  bank_name: string | null
  received_at: string
  raw_body: string | null
  paired_log_id: string | null
  own_transfer_verdict: string | null
  own_transfer_candidate: string | null
}

const fail = (message: string, status = 500) => NextResponse.json({ error: message }, { status })

async function setLogs(service: Service, ids: string[], values: Record<string, unknown>): Promise<boolean> {
  const { error } = await service.from('sms_parse_log').update(values).in('id', ids)
  if (error) console.error('[sms/own-transfer] log update error', error.message)
  return !error
}

async function nudge(userId: string, logId: string): Promise<void> {
  try {
    await nudgeUser(userId, 'sms', { logId })
  } catch {
    /* best effort */
  }
}

export async function POST(request: Request) {
  const outdated = await gateOutdatedClient(request)
  if (outdated) return outdated
  const service = createServiceRoleClient()
  const hasBearer = (request.headers.get('authorization') ?? '').startsWith('Bearer ')
  const caller = hasBearer
    ? await resolveSmsCaller(request)
    : { userId: await resolveActiveApiUserId(request), deviceId: null, viaJwt: false }
  const { userId } = caller
  if (!userId) return fail('Unauthorized', 401)
  const blocked = await smsDeviceGate(service, caller)
  if (blocked) return blocked

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return fail('Invalid JSON', 400)
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) return fail('Invalid body', 400)
  const { parseLogId, action } = parsed.data

  const { data: l } = await service.from('sms_parse_log').select(LOG_COLUMNS).eq('id', parseLogId).single()
  const logRow = l as LogRow | null
  if (!logRow) return fail('Parse log not found', 404)
  if (logRow.user_id !== userId) return fail('Forbidden', 403)
  if (logRow.own_transfer_verdict !== ALLOWED_VERDICT[action]) return fail('Not allowed in this state', 409)

  if (action === 'confirm_account' || action === 'decline_account') {
    const result = await answerOneLegQuestion(service, userId, logRow, action)
    if (!result.ok) return fail(result.error, result.status)
    await nudge(userId, logRow.id)
    return NextResponse.json(result.stale ? { ok: true, stale: true } : { ok: true, action })
  }

  const partnerId = logRow.paired_log_id ?? logRow.own_transfer_candidate
  const { data: p } = partnerId ? await service.from('sms_parse_log').select(LOG_COLUMNS).eq('id', partnerId).single() : { data: null }
  const partner = p as LogRow | null
  if (!partner || partner.user_id !== userId) return fail('No partner leg', 404)
  const ids = [logRow.id, partner.id]

  const { data: exp, error: expErr } = await service
    .from('expenses')
    .select('id, sms_log_id, description')
    .eq('user_id', userId)
    .in('sms_log_id', ids)
    .is('deleted_at', null)
  if (expErr) return fail('Failed to load ledger')
  const expense = ((exp ?? []) as { id: string; sms_log_id: string; description: string | null }[]).find((e) => e.description !== 'Transfer fee')
  if (!expense) {
    // The row the question was about is gone: clear the question on both logs so it stops being offered.
    if (!(await setLogs(service, ids, { own_transfer_verdict: 'none' }))) return fail('Failed to update logs')
    await nudge(userId, logRow.id)
    return NextResponse.json({ ok: true, stale: true })
  }
  const out = expense.sms_log_id === logRow.id ? logRow : partner
  const inn = out === logRow ? partner : logRow

  const { data: inc, error: incErr } = await service
    .from('income_events')
    .select('id, sms_log_id, deleted_at, retracted_by_sms_log_id')
    .eq('user_id', userId)
    .in('sms_log_id', ids)
  if (incErr) return fail('Failed to load ledger')
  const incomes = (inc ?? []) as { id: string; sms_log_id: string; deleted_at: string | null; retracted_by_sms_log_id: string | null }[]
  const liveIncome = incomes.find((i) => !i.deleted_at)
  // Only a retraction caused by this pair is undone here; a deleted income with no marker is the user's own delete.
  const deletedIncome = incomes.find((i) => i.deleted_at && i.retracted_by_sms_log_id && ids.includes(i.retracted_by_sms_log_id))

  if (action === 'confirm') {
    const { error } = await service.from('expenses').update({ category: 'Transfer' }).eq('id', expense.id).eq('user_id', userId)
    if (error) return fail('Failed to update expense')
    if (liveIncome) {
      const { error: delErr } = await service.from('income_events').update({ deleted_at: new Date().toISOString(), retracted_by_sms_log_id: out.id }).eq('id', liveIncome.id).eq('user_id', userId)
      if (delErr) return fail('Failed to update income')
    }
    const first = await service.from('sms_parse_log').update({ paired_log_id: partner.id, own_transfer_verdict: 'settle' }).eq('id', logRow.id)
    const second = await service.from('sms_parse_log').update({ paired_log_id: logRow.id, own_transfer_verdict: 'settle' }).eq('id', partner.id)
    if (first.error || second.error) return fail('Failed to update logs')
    await rememberOwnAnswer(service, userId, out.account_last4, inn.account_last4, true)
  } else if (action === 'decline') {
    if (!(await setLogs(service, ids, { own_transfer_verdict: 'declined' }))) return fail('Failed to update logs')
    await rememberOwnAnswer(service, userId, out.account_last4, inn.account_last4, false)
  } else {
    const category = mapKindToCategory('instant_transfer_out', null, out.raw_body)
    const { error } = await service.from('expenses').update({ category }).eq('id', expense.id).eq('user_id', userId)
    if (error) return fail('Failed to update expense')
    if (deletedIncome && !liveIncome) {
      const { error: restoreErr } = await service.from('income_events').update({ deleted_at: null, retracted_by_sms_log_id: null }).eq('id', deletedIncome.id).eq('user_id', userId)
      if (restoreErr) return fail('Failed to restore income')
      // Settling cleared the link from the log to its income row; put it back with the row.
      await service.from('sms_parse_log').update({ income_id: deletedIncome.id }).eq('id', inn.id)
    } else if (incomes.length === 0 && inn.amount != null && inn.currency) {
      const { data: created, error: insErr } = await service
        .from('income_events')
        .insert({
          user_id: userId,
          name: 'Bank credit',
          amount: inn.amount,
          currency: inn.currency as Database['public']['Enums']['currency_code'],
          source_type: 'other',
          received_date: new Date(inn.received_at).toISOString().slice(0, 10),
          status: 'confirmed',
          sms_log_id: inn.id,
          occurred_at: inn.received_at,
          notes: null,
        })
        .select('id')
        .single()
      if (insErr) return fail('Failed to restore income')
      const createdId = (created as { id: string } | null)?.id
      if (createdId) await service.from('sms_parse_log').update({ income_id: createdId }).eq('id', inn.id)
    }
    if (!(await setLogs(service, ids, { paired_log_id: null, own_transfer_verdict: 'undone' }))) return fail('Failed to update logs')
    await rememberOwnAnswer(service, userId, out.account_last4, inn.account_last4, false)
  }

  await nudge(userId, logRow.id)
  return NextResponse.json({ ok: true, action })
}
