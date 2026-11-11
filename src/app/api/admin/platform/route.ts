import { APP_CONFIG } from '@/lib/config'
import { getFirebaseAdmin } from '@/lib/server/firebaseAdmin'
import {
  getEffectiveAiRuntimeConfig,
  getStoredAiRuntimeConfig,
  saveAiRuntimeConfig,
} from '@/lib/server/aiRuntimeConfig'
import { can } from '@/lib/admin/permissions'
import { confirmsLockOut, exceedsLatestRelease, LOCK_OUT_CONFIRMATION } from '@/lib/admin/minVersion'
import { STEP_UP_ERROR, stepUp } from '@/lib/server/admin/stepUp'
import { bad, guardAdmin, json, readJson } from '@/lib/server/admin/guard'
import type { Json } from '@/lib/supabase/database.types'

const SETTING_KEYS = ['maintenance', 'announcement', 'min_app_version'] as const
type SettingKey = (typeof SETTING_KEYS)[number]

function sanitizeSetting(key: SettingKey, value: Record<string, unknown>): Json | null {
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  if (key === 'maintenance') return { enabled: value.enabled === true, message: text(value.message, 300) }
  if (key === 'announcement') {
    const tone = ['info', 'warning', 'success'].includes(String(value.tone)) ? String(value.tone) : 'info'
    return { enabled: value.enabled === true, text: text(value.text, 300), tone }
  }
  const ver = /^\d+(\.\d+){0,2}$/
  const ios = text(value.ios, 12)
  const android = text(value.android, 12)
  if ((ios && !ver.test(ios)) || (android && !ver.test(android))) return null
  // Where the update screen sends people: https links only (TestFlight, Play, the APK download).
  const link = (v: unknown) => {
    const u = text(v, 300)
    return u === '' || /^https:\/\//i.test(u) ? u : null
  }
  const iosUrl = link(value.ios_url)
  const androidUrl = link(value.android_url)
  if (iosUrl === null || androidUrl === null) return null
  return { ios, android, ios_url: iosUrl, android_url: androidUrl }
}

export async function GET(req: Request) {
  const g = await guardAdmin(req, { permission: 'platform.view' })
  if (!g.ok) return g.res
  const [settings, stuck] = await Promise.all([
    g.ctx.service.from('platform_settings').select('key, value, updated_at'),
    g.ctx.service.from('integration_outbox').select('id', { count: 'exact', head: true }).in('status', ['failed', 'dead']),
  ])
  const present = (name: string) => !!process.env[name]?.trim()
  return json({
    ai: {
      keyPresent: present('GEMINI_API_KEY'),
      model: 'gemini-2.5-flash',
      stored: await getStoredAiRuntimeConfig(),
      effective: await getEffectiveAiRuntimeConfig(),
      envHints: {
        AI_RATE_LIMITING_ENABLED: process.env.AI_RATE_LIMITING_ENABLED?.trim() || null,
        AI_RATE_LIMIT_MAX: process.env.AI_RATE_LIMIT_MAX?.trim() || null,
        AI_RATE_LIMIT_WINDOW_MS: process.env.AI_RATE_LIMIT_WINDOW_MS?.trim() || null,
      },
    },
    services: [
      { name: 'Supabase (database & auth)', ok: present('SUPABASE_SECRET_KEY') || present('SUPABASE_SERVICE_ROLE_KEY') },
      { name: 'Gemini (AI planner & parsing)', ok: present('GEMINI_API_KEY') },
      { name: 'Groq (voice transcription)', ok: present('GROQ_API_KEY') },
      { name: 'Firebase (native push)', ok: getFirebaseAdmin() !== null },
      { name: 'Linear (feedback intake)', ok: present('LINEAR_API_KEY') },
      { name: `Linear status sync (webhook secret)${stuck.count ? ` · ${stuck.count} undelivered` : ''}`, ok: present('LINEAR_WEBHOOK_SECRET') && !stuck.count, optional: true },
      { name: 'Admin encryption key (pinned)', ok: present('ADMIN_AUTH_SECRET'), optional: true },
    ],
    environment: process.env.NODE_ENV,
    appUrl: APP_CONFIG.url,
    settings: Object.fromEntries((settings.data ?? []).map((s) => [s.key, { value: s.value, updatedAt: s.updated_at }])),
  })
}

/** AI throttle (same behaviour as the previous admin page). */
export async function PATCH(req: Request) {
  const g = await guardAdmin(req, { permission: 'platform.manage' })
  if (!g.ok) return g.res
  const body = await readJson<{ aiRuntime?: { rateLimitingEnabled?: unknown; rateLimitMaxRequests?: unknown; rateLimitWindowMs?: unknown }; code?: string; stepUpPassword?: string }>(req)
  const rt = body?.aiRuntime
  if (!rt || typeof rt !== 'object') return bad('Missing aiRuntime object.')

  const patch: Parameters<typeof saveAiRuntimeConfig>[0] = {}
  if (typeof rt.rateLimitingEnabled === 'boolean') patch.rateLimitingEnabled = rt.rateLimitingEnabled
  for (const [field, key] of [['rateLimitMaxRequests', 'rateLimitMaxRequests'], ['rateLimitWindowMs', 'rateLimitWindowMs']] as const) {
    const raw = rt[field]
    if (raw === undefined || raw === null) continue
    const n = Number(raw)
    if (!Number.isFinite(n)) return bad(`${field} must be a number.`)
    patch[key] = n
  }
  if (Object.keys(patch).length === 0) return bad('No valid fields to update.')

  // Switching the throttle off removes the abuse brake for every user: same proof as a minimum-version lock.
  if (patch.rateLimitingEnabled === false && !(await stepUp(g.ctx, body ?? {}))) return bad(STEP_UP_ERROR, 401)

  try {
    const before = await getStoredAiRuntimeConfig()
    const stored = await saveAiRuntimeConfig(patch, g.ctx.staff.id)
    await g.ctx.audit('platform.ai_throttle', { summary: 'Changed AI throttling', metadata: { ...patch, before } })
    return json({ ok: true, stored, effective: await getEffectiveAiRuntimeConfig() })
  } catch (err) {
    console.error('[admin/platform] failed to save the AI throttle', err)
    return bad('Could not save the AI throttle.', 500)
  }
}

export async function POST(req: Request) {
  const g = await guardAdmin(req, { permission: 'platform.manage' })
  if (!g.ok) return g.res
  const { ctx } = g
  if (!can(ctx.permissions, 'platform.manage')) return bad('Your role does not allow this.', 403)
  const body = await readJson<{ op?: string; key?: string; value?: Record<string, unknown>; confirmText?: string; code?: string; stepUpPassword?: string }>(req)
  if (body?.op !== 'set_setting' || !body.key || !(SETTING_KEYS as readonly string[]).includes(body.key) || !body.value) return bad('Unknown action.')
  const clean = sanitizeSetting(body.key as SettingKey, body.value)
  if (clean === null) return bad('Versions look like 1.2.3.')
  if (body.key === 'maintenance' && (clean as { enabled?: boolean }).enabled === true && !(await stepUp(ctx, body))) return bad(STEP_UP_ERROR, 401)
  if (body.key === 'min_app_version') {
    const { ios = '', android = '' } = clean as { ios?: string; android?: string }
    if (ios || android) {
      if (exceedsLatestRelease(ios, android) && !confirmsLockOut(body.confirmText)) {
        return bad(`That minimum is above the newest release, so every user would be locked out. Type ${LOCK_OUT_CONFIRMATION} to confirm.`, 422)
      }
      if (!(await stepUp(ctx, body))) return bad(STEP_UP_ERROR, 401)
    }
  }
  const { data: before } = await ctx.service.from('platform_settings').select('value').eq('key', body.key).maybeSingle()
  const { error } = await ctx.service.from('platform_settings').upsert({ key: body.key, value: clean, updated_by: ctx.staff.id })
  if (error) return bad('Could not save the setting.', 500)
  await ctx.audit('platform.setting', { targetType: 'setting', targetId: body.key, summary: `Changed ${body.key}`, metadata: { value: clean, before: before?.value ?? null } })
  return json({ ok: true })
}
