/** Admin dashboard config payload from `/api/admin`. */

export interface AiRuntimeSlice {
  rateLimitingEnabled: boolean
  rateLimitMaxRequests: number
  rateLimitWindowMs: number
}

export interface AdminConfig {
  ai: {
    enabled: boolean
    model: string
    keyPresent: boolean
    runtime: {
      stored: AiRuntimeSlice
      effective: AiRuntimeSlice
      persistedToDisk: boolean
      envHints: {
        AI_RATE_LIMITING_ENABLED: string | null
        AI_RATE_LIMIT_MAX: string | null
        AI_RATE_LIMIT_WINDOW_MS: string | null
      }
    }
  }
  environment: string
  appUrl: string
}

export interface AdminUserRow {
  id: string
  email: string | undefined
  created_at: string
  last_sign_in_at: string | null
  onboarding_completed: boolean
}

export interface AdminAnalyticsSnapshot {
  since: string
  days: number
  eventCount: number
  byUser: Record<
    string,
    { heartbeats: number; engagedSecondsApprox: number; sessionStarts: number }
  >
}

export interface SmsKeywordPoolRow {
  keyword: string
  lang: string | null
  hit_count: number
  last_seen: string
}

export interface SmsSenderPoolRow {
  sender: string
  hit_count: number
  txn_count: number
  last_seen: string
}

export interface SmsTemplateRow {
  id: string
  sender: string
  regex_pattern: string
  template_sample: string
  mapping_rules: Record<string, unknown>
  ai_enabled: boolean
  match_count: number
  created_at: string
  updated_at: string
  user_id: string | null
  tier: 'learned' | 'promoted'
  kind: string | null
  unique_user_count: number
  avg_ai_confidence: number | null
  last_matched_at: string | null
  promoted_at: string | null
  auto_promoted: boolean
}

export interface SmsPromotionConfig {
  id: 1
  min_match_count: number
  min_unique_users: number
  min_age_days: number
  max_failure_rate: number
  min_avg_confidence: number
  updated_at: string
}

export interface EligibleTemplate {
  template_id: string
  sender: string
  match_count: number
  unique_user_count: number
  age_days: number
  failure_rate: number
  avg_ai_confidence: number
}

export interface SmsTrackedRow {
  id: string
  user_id: string
  sender: string | null
  bank_name: string | null
  merchant: string | null
  clean_title: string | null
  amount: number | null
  currency: string | null
  kind: string | null
  failure_code: string | null
  confidence: number | null
  raw_body: string
  received_at: string
  is_duplicate: boolean
  parse_method: string | null
  source: string | null
  account_last4: string | null
  parsed_ok: boolean
  expense_id: string | null
  income_id: string | null
  pattern_id: string | null
  payment_instrument: string | null
  status: 'processing' | 'rejected' | 'failed' | 'logged' | 'notified' | 'rendered' | 'confirmed' | 'add_failed' | 'tapped'
  pushed_at: string | null
  push_result: { ok?: boolean; sent?: number; failed?: number; error?: string } | null
  confirmed_at: string | null
  acked_at: string | null
  /** AI template-learning outcome (only meaningful when parse_method='ai'). */
  learn_status: string | null
  learn_template_id: string | null
  email: string | null
}

export interface AdminSurveyRow {
  id: string
  version: number
  published: boolean
  config: unknown
  updated_at: string
}
