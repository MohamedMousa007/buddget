import { Preferences } from '@capacitor/preferences'
import { DEVICE_SECRET_HEADER } from '@/lib/auth/deviceIdConstants'

const DEVICE_SECRET_KEY = 'buddget_device_secret'

/** Keep the secret the server issued when it trusted this install (native; web gets an HttpOnly cookie instead). */
export async function storeDeviceSecret(secret: string): Promise<void> {
  try {
    await Preferences.set({ key: DEVICE_SECRET_KEY, value: secret })
  } catch {
    /* without it the next sign-in asks for an email code, which is the safe outcome */
  }
}

export async function clearDeviceSecret(): Promise<void> {
  try {
    await Preferences.remove({ key: DEVICE_SECRET_KEY })
  } catch {
    /* noop */
  }
}

/** The header proving this install is the one that was trusted; empty when never trusted or storage is unreadable. */
export async function deviceSecretHeader(): Promise<Record<string, string>> {
  try {
    const { value } = await Preferences.get({ key: DEVICE_SECRET_KEY })
    return value ? { [DEVICE_SECRET_HEADER]: value } : {}
  } catch {
    return {}
  }
}

/** Store the `deviceSecret` a trust-granting response carries. No-op when the body has none (web, or an already-upgraded device). */
export async function rememberDeviceSecret(body: { deviceSecret?: unknown } | null | undefined): Promise<void> {
  if (typeof body?.deviceSecret === 'string' && /^[0-9a-f]{64}$/.test(body.deviceSecret)) await storeDeviceSecret(body.deviceSecret)
}
