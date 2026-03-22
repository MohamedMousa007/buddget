import fs from 'fs'
import path from 'path'

const CONFIG_DIR = path.join(process.cwd(), 'data')
const CONFIG_PATH = path.join(CONFIG_DIR, 'ai-runtime-config.json')

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

function parseStored(raw: unknown): Partial<AiRuntimeConfig> & { _legacyAssistantField?: boolean } | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const out: Partial<AiRuntimeConfig> & { _legacyAssistantField?: boolean } = {}
  if (typeof o.rateLimitingEnabled === 'boolean') out.rateLimitingEnabled = o.rateLimitingEnabled
  if (typeof o.rateLimitMaxRequests === 'number') out.rateLimitMaxRequests = o.rateLimitMaxRequests
  if (typeof o.rateLimitWindowMs === 'number') out.rateLimitWindowMs = o.rateLimitWindowMs
  if (typeof o.assistantEnabled === 'boolean') out._legacyAssistantField = true
  return out
}

/**
 * Config as stored on disk (or defaults if missing / invalid).
 */
export function getStoredAiRuntimeConfig(): AiRuntimeConfig {
  const defaults = defaultFromEnv()
  try {
    if (!fs.existsSync(CONFIG_PATH)) return defaults
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as unknown
    const partial = parseStored(raw)
    if (!partial) return defaults

    let rateLimitingEnabled: boolean
    if (typeof partial.rateLimitingEnabled === 'boolean') {
      rateLimitingEnabled = partial.rateLimitingEnabled
    } else if (partial._legacyAssistantField) {
      // Old file shape: keep throttling on so behavior matches previous “limits active” installs.
      rateLimitingEnabled = true
    } else {
      rateLimitingEnabled = defaults.rateLimitingEnabled
    }

    return {
      rateLimitingEnabled,
      rateLimitMaxRequests: clampInt(
        partial.rateLimitMaxRequests ?? defaults.rateLimitMaxRequests,
        1,
        1000,
        defaults.rateLimitMaxRequests
      ),
      rateLimitWindowMs: clampInt(
        partial.rateLimitWindowMs ?? defaults.rateLimitWindowMs,
        1000,
        3_600_000,
        defaults.rateLimitWindowMs
      ),
    }
  } catch {
    return defaults
  }
}

/**
 * Effective config: stored values, then optional env overrides (serverless / ops).
 */
export function getEffectiveAiRuntimeConfig(): AiRuntimeConfig {
  const stored = getStoredAiRuntimeConfig()

  let rateLimitingEnabled = stored.rateLimitingEnabled
  if (process.env.AI_RATE_LIMITING_ENABLED?.trim()) {
    rateLimitingEnabled = parseBoolEnv(process.env.AI_RATE_LIMITING_ENABLED, stored.rateLimitingEnabled)
  }

  let rateLimitMaxRequests = stored.rateLimitMaxRequests
  if (process.env.AI_RATE_LIMIT_MAX?.trim()) {
    const n = parseInt(process.env.AI_RATE_LIMIT_MAX, 10)
    rateLimitMaxRequests = clampInt(n, 1, 1000, stored.rateLimitMaxRequests)
  }

  let rateLimitWindowMs = stored.rateLimitWindowMs
  if (process.env.AI_RATE_LIMIT_WINDOW_MS?.trim()) {
    const n = parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS, 10)
    rateLimitWindowMs = clampInt(n, 1000, 3_600_000, stored.rateLimitWindowMs)
  }

  return {
    rateLimitingEnabled,
    rateLimitMaxRequests,
    rateLimitWindowMs,
  }
}

export function saveAiRuntimeConfig(
  patch: Partial<
    Pick<AiRuntimeConfig, 'rateLimitingEnabled' | 'rateLimitMaxRequests' | 'rateLimitWindowMs'>
  >
): AiRuntimeConfig {
  const current = getStoredAiRuntimeConfig()
  const next: AiRuntimeConfig = {
    rateLimitingEnabled:
      typeof patch.rateLimitingEnabled === 'boolean'
        ? patch.rateLimitingEnabled
        : current.rateLimitingEnabled,
    rateLimitMaxRequests: clampInt(
      patch.rateLimitMaxRequests ?? current.rateLimitMaxRequests,
      1,
      1000,
      current.rateLimitMaxRequests
    ),
    rateLimitWindowMs: clampInt(
      patch.rateLimitWindowMs ?? current.rateLimitWindowMs,
      1000,
      3_600_000,
      current.rateLimitWindowMs
    ),
  }
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function hasPersistedRuntimeConfigFile(): boolean {
  try {
    return fs.existsSync(CONFIG_PATH)
  } catch {
    return false
  }
}
