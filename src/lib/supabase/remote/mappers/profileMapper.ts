import type { UserProfile, Currency } from '@/lib/store/types'
import type { ProfileRow, ProfileInsert } from '@/lib/supabase/remote/types'

export interface ProfileExtras {
  financialGoalsNotes: string
  activeBudgetPlanId: string | null
  /** New users always have this mirrored from user_profiles; true once onboarding finishes. */
  onboardingCompleted?: boolean
  displayName?: string | null
}

/** Zustand `profile` + a few top-level fields → profiles row. */
export function profileToRow(
  p: UserProfile,
  extras: ProfileExtras,
  userId: string
): ProfileInsert {
  return {
    id: userId,
    name: p.name ?? '',
    email: p.email ?? null,
    phone: p.phone ?? null,
    city: p.city ?? null,
    country: p.country ?? null,
    base_currency: p.baseCurrency,
    secondary_currency: null,
    avatar_emoji: p.avatarPresetId ?? null,
    avatar_image_path: p.avatar ?? null,
    gender: p.gender ?? null,
    financial_goals_notes: extras.financialGoalsNotes ?? '',
    active_budget_plan_id: extras.activeBudgetPlanId ?? null,
    active_shared_budget_id: null,
    default_shared_budget_plan_id: null,
    onboarding_completed: extras.onboardingCompleted ?? false,
    display_name: extras.displayName ?? null,
    no_debts_declared: p.noDebtsDeclared ?? false,
  }
}

export interface ProfileFromRowResult {
  profile: UserProfile
  extras: ProfileExtras
}

/** profiles row → Zustand `profile` + extras. */
export function profileFromRow(row: ProfileRow): ProfileFromRowResult {
  const profile: UserProfile = {
    id: row.id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    city: row.city ?? undefined,
    country: row.country ?? undefined,
    baseCurrency: row.base_currency as Currency,
    avatar: row.avatar_image_path ?? undefined,
    avatarPresetId: row.avatar_emoji ?? undefined,
    gender: (row.gender ?? null) as UserProfile['gender'],
    noDebtsDeclared: row.no_debts_declared,
    createdAt: row.created_at,
  }
  const extras: ProfileExtras = {
    financialGoalsNotes: row.financial_goals_notes ?? '',
    activeBudgetPlanId: row.active_budget_plan_id,
    onboardingCompleted: row.onboarding_completed,
    displayName: row.display_name,
  }
  return { profile, extras }
}
