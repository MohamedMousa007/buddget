/**
 * The user's answer to the one-leg question "is the account ending in these digits your own?" (verdict `ask_account`,
 * S2c step 3). It works on ONE log row: there is no partner leg. The row was booked as its plain kind (the safe default
 * while unanswered), so a yes changes what it is and a no only remembers the answer.
 */
import type { ServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/database.types'
import { resolvePaymentBrandKey } from '@/lib/payment/paymentMethodDefaults'
import { rememberOwnAnswer } from '@/lib/sms/pairing'
import { oneLegTails, readOwnAccount } from '@/lib/sms/ownAccounts'

export interface OneLegLog {
  id: string
  account_last4: string | null
  counterparty_last4: string | null
  bank_name: string | null
}

export type OneLegResult = { ok: true; stale?: true } | { ok: false; status: number; error: string }

const TRANSFER = 'Transfer'

/** The log's question is gone (its row no longer exists): clear it so it stops being offered. */
async function clearQuestion(service: ServiceClient, logId: string): Promise<OneLegResult> {
  const { error } = await service.from('sms_parse_log').update({ own_transfer_verdict: 'none', own_transfer_candidate: null }).eq('id', logId)
  return error ? { ok: false, status: 500, error: 'Failed to update logs' } : { ok: true, stale: true }
}

export async function answerOneLegQuestion(
  service: ServiceClient,
  userId: string,
  log: OneLegLog,
  action: 'confirm_account' | 'decline_account',
): Promise<OneLegResult> {
  const tail = log.counterparty_last4
  if (!tail) return clearQuestion(service, log.id)
  const [ownTail, theirTail] = oneLegTails(log.account_last4, tail)

  if (action === 'decline_account') {
    const { error } = await service.from('sms_parse_log').update({ own_transfer_verdict: 'declined' }).eq('id', log.id)
    if (error) return { ok: false, status: 500, error: 'Failed to update logs' }
    await rememberOwnAnswer(service, userId, ownTail, theirTail, false)
    return { ok: true }
  }

  const [exp, inc] = await Promise.all([
    service.from('expenses').select('id, description').eq('user_id', userId).eq('sms_log_id', log.id).is('deleted_at', null),
    service
      .from('income_events')
      .select('id, name, amount, currency, received_date, occurred_at, payment_method_id')
      .eq('user_id', userId)
      .eq('sms_log_id', log.id)
      .is('deleted_at', null),
  ])
  if (exp.error || inc.error) return { ok: false, status: 500, error: 'Failed to load ledger' }
  const expense = ((exp.data ?? []) as { id: string; description: string | null }[]).find((e) => e.description !== 'Transfer fee')
  const income = ((inc.data ?? []) as { id: string; name: string | null; amount: number; currency: string; received_date: string; occurred_at: string | null; payment_method_id: string | null }[])[0]
  if (!expense && !income) return clearQuestion(service, log.id)

  const destinationId = (await readOwnAccount(service, userId, tail, resolvePaymentBrandKey(log.bank_name))).registeredId
  if (!destinationId) return { ok: false, status: 409, error: 'Account not found' }

  if (expense) {
    // A transfer out: the money went to the registered account, so this row is the Transfer and that account its destination.
    const { error } = await service.from('expenses').update({ category: TRANSFER, to_payment_method_id: destinationId }).eq('id', expense.id).eq('user_id', userId)
    if (error) return { ok: false, status: 500, error: 'Failed to update expense' }
    const { error: logErr } = await service.from('sms_parse_log').update({ own_transfer_verdict: 'settle' }).eq('id', log.id)
    if (logErr) return { ok: false, status: 500, error: 'Failed to update logs' }
  } else {
    // A transfer in: the money came from the registered account. The income row is retracted with its cause (I4) and
    // one Transfer expense stands for the movement, debiting the account it left and crediting the one it reached.
    const { data: created, error: insErr } = await service
      .from('expenses')
      .insert({
        user_id: userId,
        expense_date: income.received_date,
        occurred_at: income.occurred_at,
        description: income.name ?? TRANSFER,
        category: TRANSFER,
        amount: income.amount,
        currency: income.currency as Database['public']['Enums']['currency_code'],
        payment_method_id: destinationId,
        to_payment_method_id: income.payment_method_id,
        sms_log_id: log.id,
        notes: null,
      })
      .select('id')
      .single()
    const expenseId = (created as { id: string } | null)?.id
    if (insErr || !expenseId) return { ok: false, status: 500, error: 'Failed to update expense' }
    const { error: delErr } = await service.from('income_events').update({ deleted_at: new Date().toISOString(), retracted_by_sms_log_id: log.id }).eq('id', income.id).eq('user_id', userId)
    if (delErr) return { ok: false, status: 500, error: 'Failed to update income' }
    const { error: logErr } = await service
      .from('sms_parse_log')
      .update({ expense_id: expenseId, income_id: null, kind: 'own_transfer', own_transfer_verdict: 'settle' })
      .eq('id', log.id)
    if (logErr) return { ok: false, status: 500, error: 'Failed to update logs' }
  }
  await rememberOwnAnswer(service, userId, ownTail, theirTail, true)
  return { ok: true }
}
