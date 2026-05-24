import type { UserProfile, Currency } from '@/lib/store/types'
import type { ProfileRow, ProfileInsert } from '@/lib/supabase/remote/types'

export interface ProfileExtras {
  financialGoalsNotes: string
  activeBudgetPlanId: string | null
  /** Secondary display currency (from AppSettings). Written to profiles.secondary_currency. */
  secondaryCurrency?: Currency | null
  /** Present on READ; preserved via round-trip test so the value stays in the
   *  store when we re-hydrate a freshly-flipped onboarding flag. */
  onboardingCompleted?: boolean
  displayName?: string | null
}

/**
 * Zustand `profile` + a few top-level fields → profiles row.
 *
 * Important: `onboarding_completed` and `display_name` are NEVER written from
 * the client. They are authoritatively set server-side by the service-role
 * route `/api/auth/complete-core-onboarding`. The sync upsert used to clobber
 * them with `false`/`null` every debounce tick — onboarding-state could not
 * persist. Leaving those fields off the insert means PostgREST keeps the
 * existing server value on upsert-conflict.
 */
export function profileToRow(
  p: UserProfile,
  extras: ProfileExtras,
  userId: string
): ProfileInsert {
  // `ProfileInsert` marks `onboarding_completed` + `display_name` as optional,
  // so omitting them here is a valid partial upsert. Cast documented for the
  // reader; no behaviour change beyond dropping the two fields.
  return {
    id: userId,
    name: p.name ?? '',
    email: p.email ?? null,
    phone: p.phone ?? null,
    city: p.city ?? null,
    country: p.country ?? null,
    base_currency: p.baseCurrency,
    secondary_currency: (extras.secondaryCurrency ?? null) as string | null,
    avatar_emoji: p.avatarPresetId ?? null,
    avatar_image_path: p.avatar ?? null,
    gender: p.gender ?? null,
    financial_goals_notes: extras.financialGoalsNotes ?? '',
    active_budget_plan_id: extras.activeBudgetPlanId ?? null,
    active_shared_budget_id: null,
    default_shared_budget_plan_id: null,
    no_debts_declared: p.noDebtsDeclared ?? false,
    no_goals_declared: p.noGoalsDeclared ?? false,
    household: p.household ?? null,
    lifestyle_tier: p.lifestyleTier ?? null,
    food_frequency: p.foodFrequency ?? null,
    transport_mode: p.transportMode ?? null,
    monthly_rent: p.monthlyRent ?? null,
    rent_includes_utilities: p.rentIncludesUtilities ?? false,
    lite_mode: p.liteMode ?? false,
    // onboarding_version written only by the complete-journey API (service role)
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
    noGoalsDeclared: row.no_goals_declared,
    household: (row.household ?? null) as UserProfile['household'],
    lifestyleTier: (row.lifestyle_tier ?? null) as UserProfile['lifestyleTier'],
    foodFrequency: (row.food_frequency ?? null) as UserProfile['foodFrequency'],
    transportMode: (row.transport_mode ?? null) as UserProfile['transportMode'],
    monthlyRent: row.monthly_rent,
    rentIncludesUtilities: row.rent_includes_utilities,
    liteMode: row.lite_mode,
    onboardingVersion: row.onboarding_version,
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
