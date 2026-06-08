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
}

export interface SmsErrorRow {
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
}

export interface AdminSurveyRow {
  id: string
  version: number
  published: boolean
  config: unknown
  updated_at: string
}
