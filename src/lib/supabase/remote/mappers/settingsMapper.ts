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
    ...(s.timezone ? { timezone: s.timezone } : {}),
    ...(s.weekStartDay !== undefined ? { week_start_day: s.weekStartDay } : {}),
    budget_entry_mode: s.budgetEntryMode,
    show_secondary_currency: s.showSecondaryCurrency,
    show_cents_in_dashboard: s.showCentsInDashboard,
    show_all_currencies_in_forms: s.showAllCurrenciesInForms,
    no_income_declared: s.noIncomeDeclared,
    dashboard_layout: s.dashboardLayout ?? 'standard',
    wealth_gold_strip: s.wealthGoldStrip ?? 'collapsed',
    tutorials_completed: s.tutorialsCompleted,
    tutorial_current_step: s.tutorialCurrentStep,
    sms_tracking_enabled: s.smsTrackingEnabled,
    sub_due_reminders: s.subDueReminders,
    sub_price_alerts: s.subPriceAlerts,
    goal_progress_alerts: s.goalProgressAlerts,
    goal_alerts: s.goalAlerts,
    privacy: (s.privacy ?? {}) as UserSettingsInsert['privacy'],
    // Left out when this copy holds none: a phone that has not received the account's answered prompts must not erase them.
    ...(s.promptState && Object.keys(s.promptState).length > 0 ? { prompt_state: s.promptState as UserSettingsInsert['prompt_state'] } : {}),
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
    timezone: row.timezone,
    weekStartDay: row.week_start_day === 0 || row.week_start_day === 1 || row.week_start_day === 6 ? row.week_start_day : undefined,
    budgetEntryMode: row.budget_entry_mode,
    showSecondaryCurrency: row.show_secondary_currency,
    showCentsInDashboard: row.show_cents_in_dashboard,
    showAllCurrenciesInForms: row.show_all_currencies_in_forms,
    noIncomeDeclared: row.no_income_declared,
    twoFactorEmailEnabled: row.two_factor_email_enabled,
    // Client-only; never synced.
    legacyOnboardingMigratedAt: null,
    dashboardLayout: row.dashboard_layout,
    wealthGoldStrip: row.wealth_gold_strip as AppSettings['wealthGoldStrip'],
    tutorialsCompleted: row.tutorials_completed ?? [],
    tutorialCurrentStep: row.tutorial_current_step ?? null,
    smsTrackingEnabled: row.sms_tracking_enabled ?? false,
    subDueReminders: row.sub_due_reminders ?? true,
    subPriceAlerts: row.sub_price_alerts ?? true,
    goalProgressAlerts: row.goal_progress_alerts ?? true,
    goalAlerts: row.goal_alerts ?? true,
    privacy: row.privacy && Object.keys(row.privacy).length > 0 ? (row.privacy as AppSettings['privacy']) : undefined,
    promptState: row.prompt_state && typeof row.prompt_state === 'object' && !Array.isArray(row.prompt_state) && Object.keys(row.prompt_state).length > 0 ? (row.prompt_state as Record<string, string>) : undefined,
    baseCurrency: opts.baseCurrency,
    secondaryCurrency: opts.secondaryCurrency,
  }
}
