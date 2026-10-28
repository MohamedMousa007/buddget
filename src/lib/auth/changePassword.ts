import { apiFetchAuth } from '@/lib/apiBase'

export type ChangePasswordResult = 'ok' | 'wrong_password' | 'reauth_required' | 'same_password' | 'rate_limited' | 'unauthenticated' | 'failed'

/**
 * Changes the password on the server: it re-authenticates, drops the biometric and trusted-device bindings, and signs out
 * every other device. Omit `currentPassword` only right after a recovery or email-code sign-in.
 */
export async function changePassword(input: { newPassword: string; currentPassword?: string; announce?: boolean }): Promise<ChangePasswordResult> {
  try {
    const res = await apiFetchAuth('/api/auth/password/change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (res.ok) {
      const { clearLocalBiometric } = await import('@/lib/native/biometricAuth')
      await clearLocalBiometric()
      return 'ok'
    }
    const body = (await res.json().catch(() => null)) as { code?: string } | null
    if (res.status === 401) return 'unauthenticated'
    if (res.status === 429) return 'rate_limited'
    if (body?.code === 'wrong_password' || body?.code === 'reauth_required' || body?.code === 'same_password') return body.code
    return 'failed'
  } catch {
    return 'failed'
  }
}
