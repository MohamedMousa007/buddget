import { apiFetchAuth } from '@/lib/apiBase'

export type TwoFactorResult = 'ok' | 'wrong_password' | 'reauth_required' | 'rate_limited' | 'failed'

/** Switches email 2-step on or off on the server. Turning it off must be re-authenticated; the server decides what counts. */
export async function setTwoFactor(enabled: boolean, currentPassword?: string): Promise<TwoFactorResult> {
  try {
    const res = await apiFetchAuth('/api/auth/two-factor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, ...(currentPassword ? { currentPassword } : {}) }),
    })
    if (res.ok) return 'ok'
    if (res.status === 429) return 'rate_limited'
    const body = (await res.json().catch(() => null)) as { code?: string } | null
    return body?.code === 'wrong_password' || body?.code === 'reauth_required' ? body.code : 'failed'
  } catch {
    return 'failed'
  }
}
