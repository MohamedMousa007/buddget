import { createClient } from '@/lib/supabase/client'
import type { PlanOp } from '@/lib/budget/ops'
import type { BudgetPlanCategory } from '@/lib/store/types'

export interface FeedbackEntry {
  planId: string
  text: string
  ops: PlanOp[]
  before: BudgetPlanCategory[]
  after: BudgetPlanCategory[]
  outcome: 'applied' | 'undone'
}

/** Best-effort record of an adjust-by-text request; never blocks or fails the edit. */
export async function logAdjustFeedback(e: FeedbackEntry): Promise<void> {
  try {
    const supabase = createClient()
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    await supabase.from('budget_feedback').insert({
      user_id: data.user.id,
      plan_id: e.planId,
      feedback_text: e.text,
      ops: e.ops as unknown as never,
      budget_before: e.before as unknown as never,
      budget_after: e.after as unknown as never,
      outcome: e.outcome,
    })
  } catch {
    // feedback is a learning signal, not a dependency
  }
}
