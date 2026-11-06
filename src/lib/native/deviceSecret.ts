import { Preferences } from '@capacitor/preferences'
import { DEVICE_SECRET_HEADER } from '@/lib/auth/deviceIdConstants'

/** Where builds before the secure store kept the secret (UserDefaults / plain SharedPreferences). Read once, migrated, removed. */
const LEGACY_KEY = 'buddget_device_secret'

const secure = () => import('@/lib/native/smsTracker')

/** Keep the secret the server issued when it trusted this install (native; web gets an HttpOnly cookie instead). Stored in the Keychain / EncryptedSharedPreferences, the store the SMS token uses. */
export async function storeDeviceSecret(secret: string): Promise<void> {
  try {
    // Without the secure store nothing is kept, and the next sign-in asks for an email code, which is the safe outcome.
    if (await (await secure()).setSecureDeviceSecret(secret)) await Preferences.remove({ key: LEGACY_KEY })
  } catch {
    /* noop */
  }
}

export async function clearDeviceSecret(): Promise<void> {
  try {
    await (await secure()).removeSecureDeviceSecret()
  } catch {
    /* noop */
  }
  try {
    await Preferences.remove({ key: LEGACY_KEY })
  } catch {
    /* noop */
  }
}

async function readLegacy(): Promise<string | null> {
  try {
    return (await Preferences.get({ key: LEGACY_KEY })).value || null
  } catch {
    return null
  }
}

/** The header proving this install is the one that was trusted; empty when never trusted or storage is unreadable. */
export async function deviceSecretHeader(): Promise<Record<string, string>> {
  try {
    const sms = await secure()
    let value = await sms.getSecureDeviceSecret()
    if (!value) {
      value = await readLegacy()
      // One-time migration: the legacy copy is only removed once the secure store holds it.
      if (value && (await sms.setSecureDeviceSecret(value))) await Preferences.remove({ key: LEGACY_KEY })
    }
    return value ? { [DEVICE_SECRET_HEADER]: value } : {}
  } catch {
    return {}
  }
}

/** Store the `deviceSecret` a trust-granting response carries. No-op when the body has none (web, or an already-upgraded device). */
export async function rememberDeviceSecret(body: { deviceSecret?: unknown } | null | undefined): Promise<void> {
  if (typeof body?.deviceSecret === 'string' && /^[0-9a-f]{64}$/.test(body.deviceSecret)) await storeDeviceSecret(body.deviceSecret)
}
