/**
 * POST /api/sms/flag-action
 *
 * Answers on a flagged bank-message row that change columns only the server may write (S2c, I8):
 * `refund_match` points an unmatched refund at the purchase the user picked, and `deposit_income` turns a cash-deposit
 * transfer from the user's cash account into income. Auth and device gate match /api/sms/own-transfer.
 */

import { gateOutdatedClient } from '@/lib/server/clientGate'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { resolveActiveApiUserId } from '@/lib/auth/resolveApiUser'
import { resolveSmsCaller } from '@/lib/sms/resolveSmsUser'
import { smsDeviceGate } from '@/lib/sms/deviceGate'
import type { Database } from '@/lib/supabase/database.types'
import { nudgeUser } from '@/lib/server/realtime/nudge'

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('refund_match'), expenseId: z.string().uuid(), targetExpenseId: z.string().uuid() }),
  z.object({ action: z.literal('deposit_income'), expenseId: z.string().uuid() }),
])

type Service = ReturnType<typeof createServiceRoleClient>

interface ExpenseRow {
  id: string
  amount: number
  currency: string
  sms_log_id: string | null
  refund_kind: string | null
  refunded_at: string | null
  sms_flags: string[] | null
}
interface DepositRow {
  id: string
  amount: number
  currency: Database['public']['Enums']['currency_code']
  expense_date: string
  occurred_at: string | null
  sms_log_id: string | null
  category: string
  to_payment_method_id: string | null
  sms_flags: string[] | null
}

const fail = (message: string, status = 500) => NextResponse.json({ error: message }, { status })
const conflict = () => fail('Not allowed in this state', 409)

async function refundMatch(service: Service, userId: string, expenseId: string, targetId: string): Promise<NextResponse | null> {
  const { data: p } = await service
    .from('expenses')
    .select('id, amount, currency, sms_log_id, refund_kind, refunded_at, sms_flags')
    .eq('id', expenseId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  const placeholder = p as ExpenseRow | null
  if (!placeholder?.sms_log_id || placeholder.refund_kind !== 'refunded' || !placeholder.sms_flags?.includes('refund_unmatched')) return conflict()

  const { data: t } = await service
    .from('expenses')
    .select('id, amount, currency, sms_log_id, refund_kind, refunded_at, sms_flags')
    .eq('id', targetId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .is('refunded_at', null)
    .maybeSingle()
  const target = t as ExpenseRow | null
  if (!target || target.id === placeholder.id || target.currency !== placeholder.currency || Math.abs(target.amount - placeholder.amount) >= 0.005) return conflict()

  // None of these writes touch edited_at: only the app's own row push does.
  const stamp = await service
    .from('expenses')
    .update({ refunded_at: placeholder.refunded_at, refund_kind: 'refunded', refund_sms_log_id: placeholder.sms_log_id })
    .eq('id', target.id)
    .eq('user_id', userId)
    .is('refunded_at', null)
  if (stamp.error) return fail('Failed to update purchase')

  const retire = await service.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', placeholder.id).eq('user_id', userId)
  if (retire.error) {
    await service.from('expenses').update({ refunded_at: null, refund_kind: null, refund_sms_log_id: null }).eq('id', target.id).eq('user_id', userId)
    return fail('Failed to update refund')
  }
  const log = await service.from('sms_parse_log').update({ expense_id: target.id }).eq('id', placeholder.sms_log_id).eq('user_id', userId)
  if (log.error) console.error('[sms/flag-action] log update error', log.error.message)
  return null
}

async function depositIncome(service: Service, userId: string, expenseId: string): Promise<NextResponse | null> {
  const { data: x } = await service
    .from('expenses')
    .select('id, amount, currency, expense_date, occurred_at, sms_log_id, category, to_payment_method_id, sms_flags')
    .eq('id', expenseId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  const expense = x as DepositRow | null
  if (!expense?.sms_log_id || !expense.sms_flags?.includes('cash_deposit') || expense.category !== 'Transfer') return conflict()

  const retract = await service
    .from('expenses')
    .update({ deleted_at: new Date().toISOString(), retracted_by_sms_log_id: expense.sms_log_id })
    .eq('id', expense.id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .select('id')
  if (retract.error) return fail('Failed to update transfer')
  if (!retract.data?.length) return conflict()

  const { data: created, error: insErr } = await service
    .from('income_events')
    .insert({
      user_id: userId,
      template_id: null,
      name: 'Cash deposit',
      amount: expense.amount,
      currency: expense.currency,
      source_type: 'other',
      received_date: expense.expense_date,
      occurrence_date: null,
      status: 'confirmed',
      sms_log_id: expense.sms_log_id,
      payment_method_id: expense.to_payment_method_id,
      occurred_at: expense.occurred_at,
      notes: null,
    })
    .select('id')
    .single()
  const incomeId = (created as { id: string } | null)?.id
  if (insErr || !incomeId) {
    await service.from('expenses').update({ deleted_at: null, retracted_by_sms_log_id: null }).eq('id', expense.id).eq('user_id', userId).eq('retracted_by_sms_log_id', expense.sms_log_id)
    return fail('Failed to book income')
  }
  const log = await service.from('sms_parse_log').update({ income_id: incomeId, expense_id: null }).eq('id', expense.sms_log_id).eq('user_id', userId)
  if (log.error) console.error('[sms/flag-action] log update error', log.error.message)
  return null
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
  const body = parsed.data

  const refused =
    body.action === 'refund_match'
      ? await refundMatch(service, userId, body.expenseId, body.targetExpenseId)
      : await depositIncome(service, userId, body.expenseId)
  if (refused) return refused

  try {
    await nudgeUser(userId, 'sms', { action: body.action })
  } catch {
    /* best effort */
  }
  return NextResponse.json({ ok: true, action: body.action })
}
