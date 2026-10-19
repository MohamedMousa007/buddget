/**
 * Every per-user limit the platform knows about. A plan sets them in bulk; an individual entitlement can
 * override any of them. `enforced` marks the ones the app actually checks today, so the admin portal can
 * tell staff which switches are live and which are reserved for upcoming gating.
 */
export interface LimitDefinition {
  label: string
  unit: string
  description: string
  /** Applied when neither the plan nor an override sets the limit. `null` = unlimited. */
  fallback: number | null
  enforced: boolean
}

export const LIMIT_CATALOG = {
  ai_budget_per_hour: {
    label: 'AI budget calls',
    unit: 'per hour',
    description: 'Budget builder and adjust requests to the AI planner.',
    fallback: 15,
    enforced: true,
  },
  ai_chat_per_day: {
    label: 'AI assistant messages',
    unit: 'per day',
    description: 'Buddgy chat and command requests.',
    fallback: null,
    enforced: false,
  },
  receipt_scans_per_month: {
    label: 'Receipt scans',
    unit: 'per month',
    description: 'Photo receipt extraction.',
    fallback: null,
    enforced: false,
  },
  voice_entries_per_day: {
    label: 'Voice entries',
    unit: 'per day',
    description: 'Voice transcription requests.',
    fallback: null,
    enforced: false,
  },
  budget_plans_max: {
    label: 'Saved budget plans',
    unit: 'plans',
    description: 'Active plus archived budget plans.',
    fallback: null,
    enforced: false,
  },
  sms_accounts_max: {
    label: 'SMS-tracked accounts',
    unit: 'accounts',
    description: 'Bank senders tracked automatically.',
    fallback: null,
    enforced: false,
  },
} as const satisfies Record<string, LimitDefinition>

export type LimitKey = keyof typeof LIMIT_CATALOG

export const LIMIT_KEYS = Object.keys(LIMIT_CATALOG) as LimitKey[]

export function isLimitKey(value: string): value is LimitKey {
  return Object.hasOwn(LIMIT_CATALOG, value)
}

/** Boolean capabilities a plan can include. Reserved names so plans and flags agree on spelling. */
export const FEATURE_CATALOG = {
  ai_assistant: 'AI assistant',
  advanced_reports: 'Advanced reports',
  sms_tracking: 'Automatic SMS tracking',
  receipt_scanning: 'Receipt scanning',
  multi_currency: 'Multi-currency',
  data_export: 'Data export',
  priority_support: 'Priority support',
} as const

export type FeatureKey = keyof typeof FEATURE_CATALOG

export function isFeatureKey(value: string): value is FeatureKey {
  return Object.hasOwn(FEATURE_CATALOG, value)
}
