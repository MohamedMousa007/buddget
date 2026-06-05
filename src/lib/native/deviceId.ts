import { Preferences } from '@capacitor/preferences'

const DEVICE_ID_KEY = 'buddget_device_id'

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
