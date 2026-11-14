/**
 * Reversal of an own-transfer pairing ("this is not an own transfer"). Both legs come back as their plain rows.
 *
 * The other reverse operation, "forget this message", is the SQL function sms_discard_message (migration 0273); it
 * lives in the database so the undo route and the app's row delete run the same code.
 */

import type { ServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/database.types'
import { mapKindToCategory } from './createSmsExpense'

export interface UnpairLeg {
  id: string
  amount: number | null
  currency: string | null
  received_at: string
  raw_body: string | null
}

export interface UnpairIncomeRow {
  id: string
  deleted_at: string | null
  retracted_by_sms_log_id: string | null
}

export interface UnpairInput {
  userId: string
  /** The leg that owns the pair's Transfer expense. */
  out: UnpairLeg
  /** The other leg. */
  inn: UnpairLeg
  expenseId: string
  /** Every income row of the pair's two messages, live or not. */
  incomes: UnpairIncomeRow[]
}

/**
 * Puts the Transfer expense back to what a plain transfer out gets, and the other leg's income back. Only an income
 * whose retraction marker names one of the pair's two messages is restored (I4); one deleted with no marker was
 * deleted by the user. With no income row at all (the pair never retracted one), the in leg's income is created.
 * Returns an error message, or null. Clearing the link on the logs is the caller's job.
 */
export async function unpairOwnTransfer(service: ServiceClient, input: UnpairInput): Promise<string | null> {
  const { userId, out, inn, expenseId, incomes } = input
  const pair = [out.id, inn.id]
  const liveIncome = incomes.find((i) => !i.deleted_at)
  const retractedIncome = incomes.find((i) => i.deleted_at && i.retracted_by_sms_log_id && pair.includes(i.retracted_by_sms_log_id))

  const category = mapKindToCategory('instant_transfer_out', null, out.raw_body)
  const { error } = await service.from('expenses').update({ category }).eq('id', expenseId).eq('user_id', userId)
  if (error) return 'Failed to update expense'

  if (retractedIncome && !liveIncome) {
    const { error: restoreErr } = await service.from('income_events').update({ deleted_at: null, retracted_by_sms_log_id: null }).eq('id', retractedIncome.id).eq('user_id', userId)
    if (restoreErr) return 'Failed to restore income'
    // Settling cleared the link from the log to its income row; put it back with the row.
    await service.from('sms_parse_log').update({ income_id: retractedIncome.id }).eq('id', inn.id)
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
    if (insErr) return 'Failed to restore income'
    const createdId = (created as { id: string } | null)?.id
    if (createdId) await service.from('sms_parse_log').update({ income_id: createdId }).eq('id', inn.id)
  }
  return null
}
