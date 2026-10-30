import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { spendBlocks } from '@/lib/server/ai/spendGuard'
import { computeUnits, type TokenUsage } from '@/lib/server/ai/units'

/** `chat_hop` is a tool-loop continuation inside one user turn: counted for cost, not as a new turn. */
export type AiFeature = 'chat' | 'chat_hop' | 'proxy' | 'voice' | 'receipt' | 'budget' | 'goals' | 'sms'

export type QuotaLayer =
  | 'feature_disabled'
  | 'rate'
  | 'chats_hour'
  | 'chats_day'
  | 'window_5h'
  | 'window_24h'
  | 'window_7d'
  | 'chat_messages_day'
  | 'receipts_month'
  | 'voice_day'
  | 'unavailable'

export interface QuotaGrant {
  allowed: true
  userId: string
  reservationId: string | null
  chatId: string | null
  newChat: boolean
  /** The previous chat hit its hard cap; the client should carry its summary over. */
  rolled: boolean
  /** The chat passed its soft budget; compress harder and suggest a fresh chat. */
  soft: boolean
  /** Features and `tool:<domain>` entries switched off for this user's plan. */
  disabled: string[]
}

export interface QuotaDenied {
  allowed: false
  layer: QuotaLayer
  resetAt: string | null
}

export type QuotaResult = QuotaGrant | QuotaDenied

interface ReserveRow {
  allowed: boolean
  layer?: QuotaLayer
  reset_at?: string | null
  reservation_id?: string
  chat_id?: string | null
  new_chat?: boolean
  rolled?: boolean
  soft?: boolean
  disabled?: string[]
}

/** Local dev without Supabase has no quota store; there is nothing to protect. */
export function quotaStoreAvailable(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SECRET_KEY?.trim())
}

export async function reserveAiQuota(args: {
  userId: string
  feature: AiFeature
  estUnits: number
  chatId?: string | null
}): Promise<QuotaResult> {
  if (!quotaStoreAvailable() && process.env.NODE_ENV !== 'production') {
    return { allowed: true, userId: args.userId, reservationId: null, chatId: args.chatId ?? null, newChat: false, rolled: false, soft: false, disabled: [] }
  }
  if (await spendBlocks(args.feature)) return { allowed: false, layer: 'feature_disabled', resetAt: null }
  try {
    const params = {
      p_user: args.userId,
      // The generated RPC type requires a string; the function treats NULL as "no chat yet".
      p_chat: (args.chatId ?? null) as string,
      p_feature: args.feature,
      p_est: Math.max(0, Math.round(args.estUnits)),
    }
    // v2 also counts in-flight reservations against per-month/day caps; until migration 0224 is applied fall back to v1.
    let useV1 = false
    const reserve = async () => {
      const client = createServiceRoleClient()
      if (!useV1) {
        const res = await client.rpc('ai_quota_reserve_v2', params)
        if (res.error?.code !== 'PGRST202') return res
        useV1 = true
      }
      return client.rpc('ai_quota_reserve', params)
    }
    let { data, error } = await reserve()
    // The database can blink (a 503 for a second); one retry turns that into a slow message, not a dead one.
    if (error || !data) {
      await new Promise((r) => setTimeout(r, 400))
      ;({ data, error } = await reserve())
    }
    if (error || !data) {
      console.error('[ai-quota] reserve failed', error?.message)
      return { allowed: false, layer: 'unavailable', resetAt: null }
    }
    const row = data as unknown as ReserveRow
    if (!row.allowed) return { allowed: false, layer: row.layer ?? 'unavailable', resetAt: row.reset_at ?? null }
    return {
      allowed: true,
      userId: args.userId,
      reservationId: row.reservation_id ?? null,
      chatId: row.chat_id ?? null,
      newChat: row.new_chat === true,
      rolled: row.rolled === true,
      soft: row.soft === true,
      disabled: Array.isArray(row.disabled) ? row.disabled : [],
    }
  } catch (e) {
    console.error('[ai-quota] reserve threw', e instanceof Error ? e.message : e)
    return { allowed: false, layer: 'unavailable', resetAt: null }
  }
}

export interface SettleArgs {
  model: string
  tier: string
  latencyMs: number
  usage: TokenUsage
  status: 'ok' | 'error' | 'aborted'
}

/** Records what the call actually cost. Failures are logged, never thrown into the response path. */
export async function settleAiQuota(grant: QuotaGrant, args: SettleArgs): Promise<void> {
  if (!grant.reservationId) return
  try {
    const { error } = await createServiceRoleClient().rpc('ai_quota_settle', {
      p_reservation: grant.reservationId,
      p_user: grant.userId,
      p_units: computeUnits(args.usage),
      p_in: args.usage.promptTokens,
      p_cached: args.usage.cachedTokens,
      p_out: args.usage.outputTokens,
      p_model: args.model,
      p_tier: args.tier,
      p_latency: args.latencyMs,
      p_status: args.status,
    })
    if (error) console.error('[ai-quota] settle failed', error.message)
  } catch (e) {
    console.error('[ai-quota] settle threw', e instanceof Error ? e.message : e)
  }
}

export async function releaseAiQuota(grant: QuotaGrant): Promise<void> {
  if (!grant.reservationId) return
  try {
    await createServiceRoleClient().rpc('ai_quota_release', { p_reservation: grant.reservationId, p_user: grant.userId })
  } catch (e) {
    console.error('[ai-quota] release threw', e instanceof Error ? e.message : e)
  }
}

/** 429 for a spent limit, 503 when the quota store itself is unreachable. */
export function quotaDeniedResponse(denied: QuotaDenied): NextResponse {
  const status = denied.layer === 'unavailable' ? 503 : denied.layer === 'feature_disabled' ? 403 : 429
  const headers: Record<string, string> = {}
  if (denied.resetAt) {
    const seconds = Math.max(1, Math.ceil((new Date(denied.resetAt).getTime() - Date.now()) / 1000))
    headers['Retry-After'] = String(seconds)
  }
  return NextResponse.json(
    { error: 'ai_quota', layer: denied.layer, resetAt: denied.resetAt, stage: 'quota' },
    { status, headers },
  )
}
