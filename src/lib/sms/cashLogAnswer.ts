/**
 * The user's answer to "Do you log what you spend in cash?" as stored in `user_settings.prompt_state`. The key strings
 * are a contract with the client (src/lib/spending/cashLog.ts, which imports client stores and so is not imported here;
 * a test asserts the two copies are equal). Both keys may be present, and the later time wins; none is unanswered.
 */
import type { ServiceClient } from '@/lib/supabase/service'

export const CASH_LOG_YES = 'cashlog:yes'
export const CASH_LOG_NO = 'cashlog:no'

export function winningCashLogAnswer(promptState: unknown): 'yes' | 'no' | null {
  if (!promptState || typeof promptState !== 'object' || Array.isArray(promptState)) return null
  const at = (key: string): number | null => {
    const v = (promptState as Record<string, unknown>)[key]
    const ms = typeof v === 'string' ? Date.parse(v) : NaN
    return Number.isFinite(ms) ? ms : null
  }
  const yes = at(CASH_LOG_YES)
  const no = at(CASH_LOG_NO)
  if (yes === null && no === null) return null
  if (no === null) return 'yes'
  if (yes === null) return 'no'
  return no > yes ? 'no' : 'yes'
}

/** True when the user has answered "no": each new cash withdrawal is booked as ordinary spending. A failed read is unanswered. */
export async function cashWithdrawalsAreSpending(service: ServiceClient, userId: string): Promise<boolean> {
  const { data, error } = await service.from('user_settings').select('prompt_state').eq('user_id', userId).maybeSingle()
  return !error && winningCashLogAnswer(data?.prompt_state) === 'no'
}
