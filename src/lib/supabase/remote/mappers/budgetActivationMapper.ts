import type { BudgetPlanActivation } from '@/lib/store/types'
import type { Database } from '@/lib/supabase/database.types'

type ActivationRow = Database['public']['Tables']['budget_plan_activations']['Row']
type ActivationInsert = Database['public']['Tables']['budget_plan_activations']['Insert']

export function activationToRow(a: BudgetPlanActivation, userId: string): ActivationInsert {
  return { id: a.id, user_id: userId, plan_id: a.planId, effective_from: a.effectiveFrom, created_at: a.createdAt, edited_at: a.updatedAt }
}

export function activationFromRow(row: ActivationRow): BudgetPlanActivation {
  return { id: row.id, planId: row.plan_id, effectiveFrom: row.effective_from, createdAt: row.created_at, updatedAt: row.edited_at }
}
