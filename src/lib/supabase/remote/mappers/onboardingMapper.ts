import type { OnboardingState } from '@/lib/store/types'
import type { OnboardingStateRow, OnboardingStateInsert } from '@/lib/supabase/remote/types'
import type { Json } from '@/lib/supabase/database.types'

/**
 * Zustand `onboardingState` → onboarding_state row.
 * Note: aiPlans / aiGeneratedAt / selectedPlanIndex / lastValidationNotes are not persisted —
 * they're deprecated from the plan-picker era. `phase` is inferred server-side; not stored here.
 */
export function onboardingToRow(
  o: OnboardingState,
  userId: string
): OnboardingStateInsert {
  return {
    user_id: userId,
    answers: (o.answers ?? {}) as Json,
    current_step_index: o.currentStepIndex ?? 0,
    flow_version: o.flowVersion ?? 1,
    plan_accepted: o.planAccepted ?? false,
    draft_entries: (o.draftEntries ?? {}) as Json,
  }
}

export function onboardingFromRow(row: OnboardingStateRow): OnboardingState {
  return {
    flowVersion: row.flow_version,
    answers: (row.answers as Record<string, unknown>) ?? {},
    currentStepIndex: row.current_step_index,
    planAccepted: row.plan_accepted,
    draftEntries: (row.draft_entries as Record<string, unknown>) ?? {},
    // Deprecated fields — kept for backward compat with the Zustand type.
    selectedPlanIndex: null,
    aiPlans: null,
    aiGeneratedAt: null,
    lastValidationNotes: null,
  }
}
