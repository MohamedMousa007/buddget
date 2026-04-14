import { NextResponse } from 'next/server'
import {
  getStoredAiRuntimeConfig,
  getEffectiveAiRuntimeConfig,
  saveAiRuntimeConfig,
  hasPersistedRuntimeConfigFile,
} from '@/lib/server/aiRuntimeConfig'
import { verifyAdminPin } from '@/lib/server/adminAuth'
import { APP_CONFIG } from '@/lib/config'

function buildAdminConfig() {
  const hasGeminiKey = !!process.env.GEMINI_API_KEY?.trim()

  const stored = getStoredAiRuntimeConfig()
  const effective = getEffectiveAiRuntimeConfig()

  return {
    ai: {
      /** Key present — AI routes are available (Gemini quotas still apply). */
      enabled: hasGeminiKey,
      model: 'gemini-2.5-flash',
      /** Never expose key material — boolean only. */
      keyPresent: hasGeminiKey,
      runtime: {
        /** Values last saved from Admin (or defaults). */
        stored,
        /** Values actually used (env can override). */
        effective,
        persistedToDisk: hasPersistedRuntimeConfigFile(),
        envHints: {
          AI_RATE_LIMITING_ENABLED: process.env.AI_RATE_LIMITING_ENABLED?.trim() || null,
          AI_RATE_LIMIT_MAX: process.env.AI_RATE_LIMIT_MAX?.trim() || null,
          AI_RATE_LIMIT_WINDOW_MS: process.env.AI_RATE_LIMIT_WINDOW_MS?.trim() || null,
        },
      },
    },
    environment: process.env.NODE_ENV,
    appUrl: APP_CONFIG.url,
  }
}

export async function POST(req: Request) {
  try {
    const { pin } = await req.json()
    const denied = verifyAdminPin(pin)
    if (denied) return denied

    return NextResponse.json({
      authenticated: true,
      config: buildAdminConfig(),
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

/**
 * Update optional per-device throttling (persisted under /data/ai-runtime-config.json).
 * Env vars AI_RATE_LIMITING_ENABLED, AI_RATE_LIMIT_*, when set, override at runtime.
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { pin, aiRuntime } = body ?? {}
    const denied = verifyAdminPin(pin)
    if (denied) return denied

    if (!aiRuntime || typeof aiRuntime !== 'object') {
      return NextResponse.json({ error: 'Missing aiRuntime object' }, { status: 400 })
    }

    const patch: Parameters<typeof saveAiRuntimeConfig>[0] = {}

    if (typeof aiRuntime.rateLimitingEnabled === 'boolean') {
      patch.rateLimitingEnabled = aiRuntime.rateLimitingEnabled
    }
    if (aiRuntime.rateLimitMaxRequests !== undefined && aiRuntime.rateLimitMaxRequests !== null) {
      const n = Number(aiRuntime.rateLimitMaxRequests)
      if (!Number.isFinite(n)) {
        return NextResponse.json({ error: 'rateLimitMaxRequests must be a number' }, { status: 400 })
      }
      patch.rateLimitMaxRequests = n
    }
    if (aiRuntime.rateLimitWindowMs !== undefined && aiRuntime.rateLimitWindowMs !== null) {
      const n = Number(aiRuntime.rateLimitWindowMs)
      if (!Number.isFinite(n)) {
        return NextResponse.json({ error: 'rateLimitWindowMs must be a number' }, { status: 400 })
      }
      patch.rateLimitWindowMs = n
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    let stored
    try {
      stored = saveAiRuntimeConfig(patch)
    } catch (err) {
      console.error('[Admin] Failed to write ai-runtime-config:', err)
      return NextResponse.json(
        {
          error:
            'Could not save settings to disk (read-only filesystem). Set AI_RATE_LIMITING_ENABLED, AI_RATE_LIMIT_MAX, and AI_RATE_LIMIT_WINDOW_MS in your host environment instead.',
        },
        { status: 507 }
      )
    }

    return NextResponse.json({
      ok: true,
      stored,
      effective: getEffectiveAiRuntimeConfig(),
      config: buildAdminConfig(),
    })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
