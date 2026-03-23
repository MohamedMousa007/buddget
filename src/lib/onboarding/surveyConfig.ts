import { z } from 'zod'

export const surveyOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
})

export const surveyStepSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('static'),
    title: z.string(),
    body: z.string(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('text'),
    title: z.string(),
    placeholder: z.string().optional(),
    mapsTo: z.string(),
    maxLength: z.number().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('number'),
    title: z.string(),
    placeholder: z.string().optional(),
    mapsTo: z.string(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('single_select'),
    title: z.string(),
    mapsTo: z.string(),
    options: z.array(surveyOptionSchema),
  }),
])

export const surveyConfigRootSchema = z.object({
  steps: z.array(surveyStepSchema),
})

export type SurveyConfig = z.infer<typeof surveyConfigRootSchema>
export type SurveyStep = z.infer<typeof surveyStepSchema>

/** Fallback if DB has no published survey */
export const DEFAULT_SURVEY_CONFIG: SurveyConfig = {
  steps: [
    {
      id: 'welcome',
      type: 'static',
      title: 'Welcome to Buddget',
      body: 'A short setup so your budget and dashboard match how you earn and spend.',
    },
    {
      id: 'display_name',
      type: 'text',
      title: 'What should we call you?',
      placeholder: 'Your name',
      mapsTo: 'profile.name',
      maxLength: 80,
    },
    {
      id: 'base_currency',
      type: 'single_select',
      title: 'Primary currency',
      mapsTo: 'settings.baseCurrency',
      options: [
        { value: 'AED', label: 'AED — UAE Dirham' },
        { value: 'USD', label: 'USD — US Dollar' },
        { value: 'EGP', label: 'EGP — Egyptian Pound' },
        { value: 'EUR', label: 'EUR — Euro' },
        { value: 'GBP', label: 'GBP — British Pound' },
        { value: 'SAR', label: 'SAR — Saudi Riyal' },
      ],
    },
    {
      id: 'secondary_currency',
      type: 'single_select',
      title: 'Also track amounts in…',
      mapsTo: 'settings.secondaryCurrency',
      options: [
        { value: 'none', label: 'No secondary currency' },
        { value: 'AED', label: 'AED' },
        { value: 'USD', label: 'USD' },
        { value: 'EGP', label: 'EGP' },
        { value: 'EUR', label: 'EUR' },
        { value: 'GBP', label: 'GBP' },
        { value: 'SAR', label: 'SAR' },
      ],
    },
    {
      id: 'income_choice',
      type: 'single_select',
      title: 'Monthly income',
      mapsTo: 'onboarding.incomeChoice',
      options: [
        {
          value: 'has_income',
          label: 'I have regular income — I’ll enter it in the next step (during signup)',
        },
        {
          value: 'no_income',
          label: 'No regular income at the moment',
        },
      ],
    },
    {
      id: 'income_monthly',
      type: 'number',
      title: 'Typical monthly take-home (signup)',
      placeholder: 'e.g. 5000',
      mapsTo: 'income.primaryMonthly',
      min: 0.01,
    },
    {
      id: 'budget_preset',
      type: 'single_select',
      title: 'Budget plan (% of your income)',
      mapsTo: 'onboarding.budgetPreset',
      options: [
        {
          value: 'balanced',
          label: 'Balanced — sensible split across needs, fun, savings, and debt',
        },
        {
          value: 'savings_focus',
          label: 'Savings-first — more for savings, tighter on enjoyment',
        },
        {
          value: 'essentials',
          label: 'Essentials-heavy — higher rent/food/transport, minimal extras',
        },
        {
          value: 'debt_focus',
          label: 'Debt paydown — prioritize paying off debt faster',
        },
      ],
    },
    {
      id: 'done',
      type: 'static',
      title: "You're set",
      body: 'We’ll open your dashboard. Primary income was set during signup; adjust budgets anytime. You can import a backup from Settings.',
    },
  ],
}

export function parseSurveyConfig(raw: unknown): SurveyConfig {
  const parsed = surveyConfigRootSchema.safeParse(raw)
  if (!parsed.success) {
    return DEFAULT_SURVEY_CONFIG
  }
  return parsed.data
}
