import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service'

/** Row key in `platform_settings`; a serverless host has no durable local disk, so the database is the store. */
const SETTING_KEY = 'ai_throttle'
const CACHE_MS = 30_000

export type AiRuntimeConfig = {
  /**
   * When false, this server does not apply any per-client (IP) request cap.
   * Google Gemini quotas still apply.
   */
  rateLimitingEnabled: boolean
  /** Used only when rateLimitingEnabled is true. */
  rateLimitMaxRequests: number
  /** Used only when rateLimitingEnabled is true. */
  rateLimitWindowMs: number
}

function clampInt(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

function parseBoolEnv(v: string | undefined, whenUnset: boolean): boolean {
  const t = v?.trim().toLowerCase()
  if (t === 'true' || t === '1') return true
  if (t === 'false' || t === '0') return false
  return whenUnset
}

function defaultFromEnv(): AiRuntimeConfig {
  return {
    rateLimitingEnabled: parseBoolEnv(process.env.AI_RATE_LIMITING_ENABLED, false),
    rateLimitMaxRequests: clampInt(
      parseInt(process.env.AI_RATE_LIMIT_MAX || '15', 10),
      1,
      1000,
      15
    ),
    rateLimitWindowMs: clampInt(
      parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS || '60000', 10),
      1000,
      3_600_000,
      60_000
    ),
  }
}

function parseStored(raw: unknown): Partial<AiRuntimeConfig> {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: Partial<AiRuntimeConfig> = {}
  if (typeof o.rateLimitingEnabled === 'boolean') out.rateLimitingEnabled = o.rateLimitingEnabled
  if (typeof o.rateLimitMaxRequests === 'number') out.rateLimitMaxRequests = o.rateLimitMaxRequests
  if (typeof o.rateLimitWindowMs === 'number') out.rateLimitWindowMs = o.rateLimitWindowMs
  return out
}

function normalise(partial: Partial<AiRuntimeConfig>, base: AiRuntimeConfig): AiRuntimeConfig {
  return {
    rateLimitingEnabled: typeof partial.rateLimitingEnabled === 'boolean' ? partial.rateLimitingEnabled : base.rateLimitingEnabled,
    rateLimitMaxRequests: clampInt(partial.rateLimitMaxRequests ?? base.rateLimitMaxRequests, 1, 1000, base.rateLimitMaxRequests),
    rateLimitWindowMs: clampInt(partial.rateLimitWindowMs ?? base.rateLimitWindowMs, 1000, 3_600_000, base.rateLimitWindowMs),
  }
}

let cache: { at: number; value: AiRuntimeConfig } | null = null

export function resetAiRuntimeConfigCache(): void {
  cache = null
}

/** The throttle as stored in `platform_settings` (env defaults when unset or unreadable). Cached briefly per instance. */
export async function getStoredAiRuntimeConfig(): Promise<AiRuntimeConfig> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value
  const defaults = defaultFromEnv()
  try {
    const { data } = await createServiceRoleClient().from('platform_settings').select('value').eq('key', SETTING_KEY).maybeSingle()
    const value = data ? normalise(parseStored(data.value), defaults) : defaults
    cache = { at: Date.now(), value }
    return value
  } catch {
    return cache?.value ?? defaults
  }
}

/** Stored values, then optional env overrides (ops). */
export async function getEffectiveAiRuntimeConfig(): Promise<AiRuntimeConfig> {
  const stored = await getStoredAiRuntimeConfig()

  let rateLimitingEnabled = stored.rateLimitingEnabled
  if (process.env.AI_RATE_LIMITING_ENABLED?.trim()) {
    rateLimitingEnabled = parseBoolEnv(process.env.AI_RATE_LIMITING_ENABLED, stored.rateLimitingEnabled)
  }

  let rateLimitMaxRequests = stored.rateLimitMaxRequests
  if (process.env.AI_RATE_LIMIT_MAX?.trim()) {
    rateLimitMaxRequests = clampInt(parseInt(process.env.AI_RATE_LIMIT_MAX, 10), 1, 1000, stored.rateLimitMaxRequests)
  }

  let rateLimitWindowMs = stored.rateLimitWindowMs
  if (process.env.AI_RATE_LIMIT_WINDOW_MS?.trim()) {
    rateLimitWindowMs = clampInt(parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS, 10), 1000, 3_600_000, stored.rateLimitWindowMs)
  }

  return { rateLimitingEnabled, rateLimitMaxRequests, rateLimitWindowMs }
}

export async function saveAiRuntimeConfig(patch: Partial<AiRuntimeConfig>, staffId: string | null): Promise<AiRuntimeConfig> {
  const next = normalise(patch, await getStoredAiRuntimeConfig())
  const { error } = await createServiceRoleClient().from('platform_settings').upsert({ key: SETTING_KEY, value: next, updated_by: staffId })
  if (error) throw new Error(error.message)
  cache = { at: Date.now(), value: next }
  return next
}
