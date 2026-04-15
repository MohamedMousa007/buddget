import type { AppSettings, Currency } from '@/lib/store/types'
import type { UserSettingsRow, UserSettingsInsert } from '@/lib/supabase/remote/types'

/** Zustand `settings` → user_settings row. Maps camelCase ↔ snake_case. */
export function settingsToRow(s: AppSettings, userId: string): UserSettingsInsert {
  return {
    user_id: userId,
    theme: s.theme === 'system' ? 'dark' : s.theme,
    language: s.language,
    enable_ai: s.enableAI,
    ai_provider: s.aiProvider,
    month_start_day: s.monthStartDay,
    budget_entry_mode: s.budgetEntryMode,
    show_secondary_currency: s.showSecondaryCurrency,
    show_cents_in_dashboard: s.showCentsInDashboard,
    show_all_currencies_in_forms: s.showAllCurrenciesInForms,
    no_income_declared: s.noIncomeDeclared,
    dismiss_onboarding_banner: s.dismissOnboardingBanner,
  }
}

export interface SettingsFromRowOptions {
  /**
   * Server `user_settings` rows don't carry baseCurrency/secondaryCurrency (those live on `profiles`).
   * Pass the matching values so the returned AppSettings matches the Zustand shape.
   */
  baseCurrency: Currency
  secondaryCurrency: Currency | null
}

export function settingsFromRow(row: UserSettingsRow, opts: SettingsFromRowOptions): AppSettings {
  return {
    theme: row.theme,
    language: row.language,
    enableAI: row.enable_ai,
    aiProvider: row.ai_provider === 'gemini' ? 'gemini' : 'gemini',
    monthStartDay: row.month_start_day,
    budgetEntryMode: row.budget_entry_mode,
    showSecondaryCurrency: row.show_secondary_currency,
    showCentsInDashboard: row.show_cents_in_dashboard,
    showAllCurrenciesInForms: row.show_all_currencies_in_forms,
    noIncomeDeclared: row.no_income_declared,
    dismissOnboardingBanner: row.dismiss_onboarding_banner,
    baseCurrency: opts.baseCurrency,
    secondaryCurrency: opts.secondaryCurrency,
  }
}
