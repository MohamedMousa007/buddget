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
    enforced: true,
  },
  receipt_scans_per_month: {
    label: 'Receipt scans',
    unit: 'per month',
    description: 'Photo receipt extraction.',
    fallback: null,
    enforced: true,
  },
  voice_entries_per_day: {
    label: 'Voice entries',
    unit: 'per day',
    description: 'Voice transcription requests.',
    fallback: null,
    enforced: true,
  },
  ai_units_5h: {
    label: 'AI units, 5 hours',
    unit: 'per rolling 5 hours',
    description: 'Total AI usage across chat, budget, receipts and voice. One unit is 1 fresh input token, 0.1 cached, 4 per output token.',
    fallback: 600000,
    enforced: true,
  },
  ai_units_24h: {
    label: 'AI units, 24 hours',
    unit: 'per rolling 24 hours',
    description: 'Daily ceiling on total AI usage.',
    fallback: 1500000,
    enforced: true,
  },
  ai_units_7d: {
    label: 'AI units, 7 days',
    unit: 'per rolling 7 days',
    description: 'Weekly ceiling on total AI usage.',
    fallback: 6000000,
    enforced: true,
  },
  ai_chat_units_soft: {
    label: 'Chat soft limit',
    unit: 'units per chat',
    description: 'Usage in one chat before its history is compressed harder.',
    fallback: 30000,
    enforced: true,
  },
  ai_chat_units_hard: {
    label: 'Chat hard limit',
    unit: 'units per chat',
    description: 'Usage in one chat before it rolls over to a new chat.',
    fallback: 60000,
    enforced: true,
  },
  ai_chat_turns: {
    label: 'Turns per chat',
    unit: 'turns',
    description: 'Turns in one chat before it rolls over.',
    fallback: 40,
    enforced: true,
  },
  ai_chats_per_hour: {
    label: 'New chats',
    unit: 'per hour',
    description: 'How many new chats can be started per hour.',
    fallback: 30,
    enforced: true,
  },
  ai_chats_per_day: {
    label: 'New chats',
    unit: 'per day',
    description: 'How many new chats can be started per day.',
    fallback: 100,
    enforced: true,
  },
  ai_req_per_min: {
    label: 'AI requests',
    unit: 'per minute',
    description: 'Burst limit across every AI feature.',
    fallback: 30,
    enforced: true,
  },
  grounded_per_day: {
    label: 'Web-search estimates',
    unit: 'per day',
    description: 'AI estimates that look up live prices (goal costs, emergency fund). Past the limit they still run, without live data.',
    fallback: 3,
    enforced: true,
  },
  sparks_per_month: {
    label: 'Sparks (monthly allowance, retired)',
    unit: 'per month',
    description: 'Retired: Sparks are now bought packs only, used after a credit limit is reached. Kept at 0 so old plan rows stay valid.',
    fallback: 0,
    enforced: false,
  },
  ai_credits_session: {
    label: 'AI credits, session',
    unit: 'per 5-hour session',
    description: 'AI usage charged by real cost (1 credit = $0.001 of model cost). A session starts with its first AI request and lasts 5 hours. SMS parsing never counts.',
    fallback: 6,
    enforced: true,
  },
  ai_credits_week: {
    label: 'AI credits, week',
    unit: 'per week',
    description: 'AI credits per week, resetting on the user\'s week-start day in their timezone. Past a limit, Sparks are used if the user has any.',
    fallback: 15,
    enforced: true,
  },
  balance_views_per_month: {
    label: 'Live balance views',
    unit: 'per month',
    description: 'Opening one account\'s live balance card. Reopening the same account within 24 hours is free; only a view that shows a bank balance counts.',
    fallback: 10,
    enforced: true,
  },
  advisor_free_per_month: {
    label: 'Free Advisor answers',
    unit: 'per month',
    description: 'Advisor answers for a plan without the Advisor, kept outside the credit windows. Used up only when the answer arrives.',
    fallback: 1,
    enforced: true,
  },
  sms_ai_calls_per_day: {
    label: 'SMS model calls',
    unit: 'per rolling 24 hours',
    description: 'Model calls made to parse bank messages no template matched. Past the limit a message is held for review, not lost.',
    fallback: 30,
    enforced: true,
  },
  sms_ai_calls_per_month: {
    label: 'SMS model calls',
    unit: 'per rolling 30 days',
    description: 'Monthly ceiling on model calls made to parse bank messages.',
    fallback: 150,
    enforced: true,
  },
  seats: {
    label: 'Seats',
    unit: 'people',
    description: 'People sharing one subscription. Reserved for a later household plan.',
    fallback: 1,
    enforced: false,
  },
  budget_plans_max: {
    label: 'Saved budget plans',
    unit: 'plans',
    description: 'Active plus archived budget plans. Enforced in the app and by a database trigger while selling is on.',
    fallback: null,
    enforced: true,
  },
  sms_accounts_max: {
    label: 'SMS-tracked accounts',
    unit: 'accounts',
    description: 'Bank senders tracked automatically. Null (unlimited) on every plan; the cap code stays in place, inactive.',
    fallback: null,
    enforced: true,
  },
} as const satisfies Record<string, LimitDefinition>

export type LimitKey = keyof typeof LIMIT_CATALOG

export const LIMIT_KEYS = Object.keys(LIMIT_CATALOG) as LimitKey[]

export function isLimitKey(value: string): value is LimitKey {
  return Object.hasOwn(LIMIT_CATALOG, value)
}

/**
 * Boolean capabilities a plan can include. Reserved names so plans and flags agree on spelling.
 *
 * `user_entitlements.feature_overrides.<name> = false` switches the surface off for that person, whatever their plan:
 * ai_assistant (chat), receipt_scanning, sms_tracking, ai_voice, ai_budget, and ai_tool_<domain> for one Buddgy tool
 * group (ai_tool_budget, ai_tool_debts, ...). The per-domain names are open-ended, see `isFeatureOverrideKey`.
 */
export const FEATURE_CATALOG = {
  ai_assistant: 'AI assistant',
  advanced_reports: 'Advanced reports',
  sms_tracking: 'Automatic SMS tracking',
  receipt_scanning: 'Receipt scanning',
  ai_voice: 'AI voice entry',
  ai_budget: 'AI budget planner',
  multi_currency: 'Multi-currency',
  data_export: 'Data export',
  buddgy_advisor: 'Buddgy Advisor',
  priority_support: 'Priority support',
} as const

export type FeatureKey = keyof typeof FEATURE_CATALOG

/** Features only a plan that lists them may use. Empty until billing ships; S6 adds a key here with the route that needs it. */
export const PAID_FEATURES: ReadonlySet<string> = new Set()

export function isFeatureKey(value: string): value is FeatureKey {
  return Object.hasOwn(FEATURE_CATALOG, value)
}

/** Override names accepted per user: the catalog plus one switch per Buddgy tool group. */
export function isFeatureOverrideKey(value: string): boolean {
  return isFeatureKey(value) || /^ai_tool_[a-z0-9_]{1,40}$/.test(value)
}
