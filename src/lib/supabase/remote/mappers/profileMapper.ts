import type { UserProfile, Currency } from '@/lib/store/types'
import type { ProfileRow, ProfileInsert } from '@/lib/supabase/remote/types'

export interface ProfileExtras {
  financialGoalsNotes: string
  activeBudgetPlanId: string | null
  /** Base display currency (from AppSettings — the single in-app home). Written to
   *  profiles.base_currency (the single server home). Sourced here, not from the
   *  profile slice, because the settings UI mutates settings.baseCurrency. */
  baseCurrency: Currency
  /** Secondary display currency (from AppSettings). Written to profiles.secondary_currency. */
  secondaryCurrency?: Currency | null
  displayName?: string | null
}

/**
 * Zustand `profile` + a few top-level fields → profiles row.
 *
 * Important: `display_name` is NEVER written from the client — it's set
 * server-side. Omitting it keeps PostgREST's existing value on upsert-conflict.
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
    base_currency: extras.baseCurrency,
    secondary_currency: (extras.secondaryCurrency ?? null) as Currency | null,
    avatar_emoji: p.avatarPresetId ?? null,
    avatar_image_path: p.avatar ?? null,
    gender: p.gender ?? null,
    financial_goals_notes: extras.financialGoalsNotes ?? '',
    active_budget_plan_id: extras.activeBudgetPlanId ?? null,
    active_shared_budget_id: null,
    default_shared_budget_plan_id: null,
    household: p.household ?? null,
    lifestyle_tier: p.lifestyleTier ?? null,
    food_frequency: p.foodFrequency ?? null,
    transport_mode: p.transportMode ?? null,
    monthly_rent: p.monthlyRent ?? null,
    rent_includes_utilities: p.rentIncludesUtilities ?? false,
    // display_name is NOT written here — it's server-authoritative. Omitting
    // it keeps PostgREST's existing value on upsert-conflict.
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
    avatar: row.avatar_image_path ?? undefined,
    avatarPresetId: row.avatar_emoji ?? undefined,
    gender: (row.gender ?? null) as UserProfile['gender'],
    household: (row.household ?? null) as UserProfile['household'],
    lifestyleTier: (row.lifestyle_tier ?? null) as UserProfile['lifestyleTier'],
    foodFrequency: (row.food_frequency ?? null) as UserProfile['foodFrequency'],
    transportMode: (row.transport_mode ?? null) as UserProfile['transportMode'],
    monthlyRent: row.monthly_rent,
    rentIncludesUtilities: row.rent_includes_utilities,
    createdAt: row.created_at,
  }
  const extras: ProfileExtras = {
    financialGoalsNotes: row.financial_goals_notes ?? '',
    activeBudgetPlanId: row.active_budget_plan_id,
    baseCurrency: row.base_currency as Currency,
    secondaryCurrency: (row.secondary_currency ?? null) as Currency | null,
    displayName: row.display_name,
  }
  return { profile, extras }
}
