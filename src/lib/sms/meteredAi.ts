import { reserveAiQuota, settleAiQuota } from '@/lib/server/ai/quota'

/**
 * Runs one SMS-triggered Gemini call under the user's AI quota (background learning and categorisation
 * used to sit outside it, so spoofed SMS could drive unmetered spend). `denied` means the call never ran.
 */
export async function withSmsAiQuota<T>(
  userId: string,
  estUnits: number,
  model: string,
  call: () => Promise<T>,
): Promise<{ denied: true } | { denied: false; value: T }> {
  const quota = await reserveAiQuota({ userId, feature: 'sms', estUnits })
  if (!quota.allowed) return { denied: true }
  const started = Date.now()
  const settle = (status: 'ok' | 'error') =>
    settleAiQuota(quota, { model, tier: 'smart', latencyMs: Date.now() - started, usage: { promptTokens: estUnits, cachedTokens: 0, outputTokens: 0 }, status })
  try {
    const value = await call()
    await settle('ok')
    return { denied: false, value }
  } catch (e) {
    await settle('error')
    throw e
  }
}
