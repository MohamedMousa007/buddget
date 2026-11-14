/**
 * POST /api/sms/flag-action
 *
 * Answers on a flagged bank-message row that change columns only the server may write (S2c, I8):
 * `refund_match` points an unmatched refund at the purchase the user picked, and `own_cash` turns a cash-deposit
 * income into a transfer from the user's cash account. Auth and device gate match /api/sms/own-transfer.
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
  z.object({ action: z.literal('own_cash'), incomeId: z.string().uuid() }),
])

type Service = ReturnType<typeof createServiceRoleClient>
type ExpenseCategory = Database['public']['Enums']['expense_category']

interface ExpenseRow {
  id: string
  amount: number
  currency: string
  sms_log_id: string | null
  refund_kind: string | null
  refunded_at: string | null
  sms_flags: string[] | null
}
interface IncomeRow {
  id: string
  amount: number
  currency: Database['public']['Enums']['currency_code']
  received_date: string
  occurred_at: string | null
  sms_log_id: string | null
  payment_method_id: string | null
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

async function ownCash(service: Service, userId: string, incomeId: string): Promise<NextResponse | null> {
  const { data: i } = await service
    .from('income_events')
    .select('id, amount, currency, received_date, occurred_at, sms_log_id, payment_method_id, sms_flags')
    .eq('id', incomeId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  const income = i as IncomeRow | null
  if (!income?.sms_log_id || !income.sms_flags?.includes('cash_deposit')) return conflict()

  // The same account a cash withdrawal lands in: the oldest open cash method, which may not exist.
  const { data: cash } = await service
    .from('payment_methods')
    .select('id')
    .eq('user_id', userId)
    .eq('type', 'cash')
    .is('deleted_at', null)
    .is('closed_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const retract = await service
    .from('income_events')
    .update({ deleted_at: new Date().toISOString(), retracted_by_sms_log_id: income.sms_log_id })
    .eq('id', income.id)
    .eq('user_id', userId)
  if (retract.error) return fail('Failed to update income')

  const { data: created, error: insErr } = await service
    .from('expenses')
    .insert({
      user_id: userId,
      amount: income.amount,
      currency: income.currency,
      expense_date: income.received_date,
      occurred_at: income.occurred_at,
      sms_log_id: income.sms_log_id,
      description: 'Cash deposit',
      category: 'Transfer' as ExpenseCategory,
      payment_method_id: (cash as { id: string } | null)?.id ?? null,
      to_payment_method_id: income.payment_method_id,
      notes: null,
    })
    .select('id')
    .single()
  const expenseId = (created as { id: string } | null)?.id
  if (insErr || !expenseId) {
    await service.from('income_events').update({ deleted_at: null, retracted_by_sms_log_id: null }).eq('id', income.id).eq('user_id', userId)
    return fail('Failed to book transfer')
  }
  const log = await service
    .from('sms_parse_log')
    .update({ expense_id: expenseId, income_id: null, kind: 'own_transfer' })
    .eq('id', income.sms_log_id)
    .eq('user_id', userId)
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
      : await ownCash(service, userId, body.incomeId)
  if (refused) return refused

  try {
    await nudgeUser(userId, 'sms', { action: body.action })
  } catch {
    /* best effort */
  }
  return NextResponse.json({ ok: true, action: body.action })
}
