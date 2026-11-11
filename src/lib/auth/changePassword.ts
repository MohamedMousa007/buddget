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
    const body = (await res.clone().json().catch(() => null)) as { code?: string; deviceSecret?: string; passwordChanged?: boolean } | null
    // The server re-trusted this device with a fresh secret (it dropped every old trust row); passwordChanged covers the partial-success 502.
    if (res.ok || body?.deviceSecret) await (await import('@/lib/native/deviceSecret')).rememberDeviceSecret(body)
    // The server dropped every biometric binding as soon as the password changed, including on the partial-success 502.
    if (res.ok || body?.passwordChanged) {
      const { clearLocalBiometric } = await import('@/lib/native/biometricAuth')
      await clearLocalBiometric()
    }
    if (res.ok) return 'ok'
    if (res.status === 401) return 'unauthenticated'
    if (res.status === 429) return 'rate_limited'
    if (body?.code === 'wrong_password' || body?.code === 'reauth_required' || body?.code === 'same_password') return body.code
    return 'failed'
  } catch {
    return 'failed'
  }
}
