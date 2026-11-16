import { createServiceRoleClient } from '@/lib/supabase/service'
import type { AdvisorGate } from '@/lib/server/ai/buddgy/plan'

interface GateRow { entitled?: boolean; free_left?: number; in_turn?: boolean }

/** Whether the Advisor is open to this user (`advisor_gate`). A failed read returns null, which locks the Advisor instead of spending it. */
export async function advisorGate(userId: string): Promise<AdvisorGate | null> {
  try {
    const { data, error } = await createServiceRoleClient().rpc('advisor_gate', { p_user: userId })
    if (error || !data) return null
    const row = data as unknown as GateRow
    return { entitled: row.entitled === true, freeOpen: (row.free_left ?? 0) > 0 || row.in_turn === true }
  } catch {
    return null
  }
}
