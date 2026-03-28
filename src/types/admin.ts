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
    keyPreview: string | null
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

export interface AdminSurveyRow {
  id: string
  version: number
  published: boolean
  config: unknown
  updated_at: string
}
