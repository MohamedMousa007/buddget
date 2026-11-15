import { createServiceRoleClient } from '@/lib/supabase/service'
import type { AiFeature } from '@/lib/server/ai/quota'

/** Capture paths people rely on without opening the app; everything else pauses when the day's cap is spent, these only at the higher ceiling. */
const ESSENTIAL: readonly AiFeature[] = ['sms', 'receipt']

export interface SpendState { costMicro: number; capUsd: number | null }

export type SpendLevel = 'ok' | 'warn' | 'capped'

export function spendLevel(s: SpendState): SpendLevel {
  if (!s.capUsd || s.capUsd <= 0) return 'ok'
  const used = s.costMicro / 1e6 / s.capUsd
  return used >= 1 ? 'capped' : used >= 0.8 ? 'warn' : 'ok'
}

/** The essential features stop at this multiple of the day's cap, so a runaway loop on them still ends. */
export const ESSENTIAL_CAP_MULTIPLE = 3

export function blocksFeature(state: SpendState, feature: AiFeature): boolean {
  const essential = ESSENTIAL.includes(feature)
  const capUsd = essential && state.capUsd ? state.capUsd * ESSENTIAL_CAP_MULTIPLE : state.capUsd
  return spendLevel({ costMicro: state.costMicro, capUsd }) === 'capped'
}

const TTL_MS = 60_000
let cached: { at: number; state: SpendState } | null = null

/** One cheap read per minute per server instance; a failed read never blocks AI. */
export async function currentSpend(): Promise<SpendState | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.state
  try {
    const { data, error } = await createServiceRoleClient().rpc('ai_spend_today')
    if (error || !data) return cached?.state ?? null
    const row = data as unknown as { costMicro: number | string; capUsd: number | string | null }
    const state = { costMicro: Number(row.costMicro), capUsd: row.capUsd == null ? null : Number(row.capUsd) }
    cached = { at: Date.now(), state }
    if (spendLevel(state) !== 'ok') console.error('[ai-spend] daily cap', spendLevel(state), state)
    return state
  } catch {
    return cached?.state ?? null
  }
}

export async function spendBlocks(feature: AiFeature): Promise<boolean> {
  const state = await currentSpend()
  return state ? blocksFeature(state, feature) : false
}
