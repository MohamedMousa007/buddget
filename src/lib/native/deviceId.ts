import { Preferences } from '@capacitor/preferences'
import { DEVICE_ID_HEADER } from '@/lib/auth/deviceIdConstants'
import { clearDeviceSecret } from '@/lib/native/deviceSecret'

const DEVICE_ID_KEY = 'buddget_device_id'

/** Forget this install's identity so the next sign-in registers as a new device (after the owner removed it). */
export async function resetDeviceId(): Promise<void> {
  try {
    await Preferences.remove({ key: DEVICE_ID_KEY })
  } catch {
    /* the next call creates a fresh id anyway on a clean install */
  }
  await clearDeviceSecret()
}

/** The device-id header every JWT SMS call must carry; empty only when storage is unreadable. */
export async function deviceIdHeader(): Promise<Record<string, string>> {
  const id = await getOrCreateDeviceId()
  return id ? { [DEVICE_ID_HEADER]: id } : {}
}

/** Stable per-install device id for trusted-device / 2FA on native. */
export async function getOrCreateDeviceId(): Promise<string | null> {
  try {
    const existing = await Preferences.get({ key: DEVICE_ID_KEY })
    if (existing.value) return existing.value
    const id = crypto.randomUUID()
    await Preferences.set({ key: DEVICE_ID_KEY, value: id })
    return id
  } catch {
    return null
  }
}

let installKey: Promise<string | null> | null = null

/**
 * This phone's reinstall-proof key (BUD-107), sent with every heartbeat so the server folds a reinstall into the same
 * row. Unlike the device id it is never reset: a removed phone still registers anew, because revoked rows never match.
 * Null on web and on builds without the native support.
 */
export function getInstallKey(): Promise<string | null> {
  installKey ??= (async () => {
    const { isAndroid, isIOS } = await import('@/lib/native/isNative')
    if (!isAndroid() && !isIOS()) return null
    const { nativeInstallKey } = await import('@/lib/native/smsTracker')
    const key = await nativeInstallKey(isAndroid() ? 'android' : 'ios')
    return key && /^[0-9a-f]{64}$/.test(key) ? key : null
  })()
  return installKey
}
